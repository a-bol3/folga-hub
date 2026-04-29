"use client";

import { useState } from "react";
import {
  Upload,
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { importCandidatesFromExcel } from "@/app/actions/import";

type ReviewFile = {
  name: string;
  type: string;
  size: number;
  url: string;
  storagePath?: string;
};

type ManualForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  placeOfBirth: string;
  countryOfBirth: string;
  citizenship: string;
  nationality: string;
  sex: string;
  documentType: string;
  documentNumber: string;
  identityNumber: string;
  issuingCountry: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  mrzRaw: string;
  observations: string;
};

const initialManualForm: ManualForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  placeOfBirth: "",
  countryOfBirth: "",
  citizenship: "",
  nationality: "",
  sex: "",
  documentType: "PASSPORT",
  documentNumber: "",
  identityNumber: "",
  issuingCountry: "",
  dateOfIssue: "",
  dateOfExpiry: "",
  mrzRaw: "",
  observations: "",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function DocumentsImportView() {
  const [isUploading, setIsUploading] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [reviewFile, setReviewFile] = useState<ReviewFile | null>(null);
  const [extractedTextPreview, setExtractedTextPreview] = useState("");
  const [extractedJson, setExtractedJson] = useState<any>(null);
  const [manualForm, setManualForm] =
    useState<ManualForm>(initialManualForm);

  const updateManual = (key: keyof ManualForm, value: string) => {
    setManualForm((prev) => ({ ...prev, [key]: value }));
  };

  const prefillManualForm = (extracted: any) => {
    if (!extracted) return;

    setManualForm((prev) => ({
      ...prev,
      firstName: extracted.firstName || "",
      lastName: extracted.lastName || "",
      dateOfBirth: formatDate(extracted.dateOfBirth),
      nationality: extracted.nationality || "",
      citizenship: extracted.issuingCountry || "",
      sex: extracted.sex || "",
      documentType: extracted.documentType || "PASSPORT",
      documentNumber: extracted.documentNumber || "",
      identityNumber: extracted.identityNumber || "",
      issuingCountry: extracted.issuingCountry || "",
      dateOfIssue: formatDate(extracted.dateOfIssue),
      dateOfExpiry: formatDate(extracted.dateOfExpiry),
      mrzRaw: extracted.mrzRaw || "",
      observations:
        "Candidate created after manual review of OCR extraction.",
    }));
  };

  const handleExcelFile = async (file: File) => {
    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await importCandidatesFromExcel(formData);

      setResult({
        success: response.success,
        msg: response.msg || response.error,
      });
    } catch (error) {
      setResult({
        success: false,
        msg: error instanceof Error ? error.message : "Import failed.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOcrFile = async (file: File) => {
    setIsOcrProcessing(true);
    setOcrResult(null);
    setReviewFile(null);
    setExtractedTextPreview("");
    setExtractedJson(null);
    setManualForm(initialManualForm);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr/identity", {
        method: "POST",
        body: formData,
      });

      const response = await res.json();

      if (response.success) {
        setOcrResult({
          success: true,
          msg: response.message,
          candidateId: response.candidateId,
        });
      } else if (response.status === "OCR_REVIEW_REQUIRED" && response.file) {
        setReviewFile(response.file);
        setExtractedTextPreview(response.extractedTextPreview || "");
        setExtractedJson(response.extracted || null);
        prefillManualForm(response.extracted);

        setOcrResult({
          success: false,
          review: true,
          msg:
            response.error ||
            "OCR requires manual review before candidate creation.",
          reasons: response.reasons || [],
        });
      } else {
        setOcrResult({
          success: false,
          msg: response.error || "OCR failed.",
          candidateId: response.candidateId,
        });
      }
    } catch (error) {
      setOcrResult({
        success: false,
        msg: `Critical Failure: ${error instanceof Error ? error.message : "Unknown error"
          }`,
      });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const submitManualReview = async () => {
    if (!reviewFile) return;

    setIsOcrProcessing(true);

    try {
      const res = await fetch("/api/documents/manual-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manualForm,
          fileName: reviewFile.name,
          fileUrl: reviewFile.url,
          fileSize: reviewFile.size,
          mimeType: reviewFile.type,
          ocrText: extractedTextPreview,
          extractedJson,
        }),
      });

      const response = await res.json();

      if (response.success) {
        setOcrResult({
          success: true,
          msg: response.message,
          candidateId: response.candidateId,
        });

        setReviewFile(null);
        setManualForm(initialManualForm);
      } else {
        setOcrResult({
          success: false,
          msg: response.error || "Manual review failed.",
          candidateId: response.candidateId,
        });
      }
    } catch (error) {
      setOcrResult({
        success: false,
        msg:
          error instanceof Error
            ? error.message
            : "Manual review failed.",
      });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const onDrop = (
    event: React.DragEvent,
    handler: (file: File) => Promise<void>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (file) handler(file);
  };

  const manualFields: Array<[keyof ManualForm, string, string]> = [
    ["firstName", "First name", "text"],
    ["middleName", "Middle name", "text"],
    ["lastName", "Last name", "text"],
    ["email", "Email", "email"],
    ["phone", "Phone", "text"],
    ["dateOfBirth", "Date of birth", "date"],
    ["placeOfBirth", "Place of birth", "text"],
    ["countryOfBirth", "Country of birth", "text"],
    ["citizenship", "Citizenship", "text"],
    ["nationality", "Nationality", "text"],
    ["sex", "Sex", "text"],
    ["documentType", "Document type", "text"],
    ["documentNumber", "Document number", "text"],
    ["identityNumber", "Identity number", "text"],
    ["issuingCountry", "Issuing country", "text"],
    ["dateOfIssue", "Date of issue", "date"],
    ["dateOfExpiry", "Date of expiry", "date"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border-2 border-dashed border-primary/50 p-6 rounded-none">
          <h2 className="font-black uppercase tracking-widest text-lg flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Importar Excel / CSV
          </h2>

          <p className="text-sm text-muted-foreground mt-2">
            Cargue una base de datos de candidatos pre-existente.
          </p>

          <label
            htmlFor="excel-file"
            className="mt-6 flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 cursor-pointer bg-muted/10 rounded-none"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, handleExcelFile)}
          >
            {isUploading ? (
              <Loader2 className="w-10 h-10 mb-3 animate-spin" />
            ) : (
              <Upload className="w-10 h-10 mb-3" />
            )}

            <span className="text-xs font-black uppercase">
              Click para buscar o arrastrar Excel
            </span>
            <span className="text-xs text-muted-foreground mt-2">
              .XLSX, .XLS, .CSV
            </span>

            <input
              id="excel-file"
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleExcelFile(file);
                e.target.value = "";
              }}
            />
          </label>

          {result && (
            <div className="mt-4 border p-4 text-xs uppercase font-bold rounded-none">
              {result.msg}
            </div>
          )}
        </section>

        <section className="border-2 border-border p-6 rounded-none">
          <h2 className="font-black uppercase tracking-widest text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            OCR Documentos de Identidad
          </h2>

          <p className="text-sm text-muted-foreground mt-2">
            Pasaportes, karta pobytu y documentos PESEL con revisión manual
            defensiva.
          </p>

          <label
            htmlFor="ocr-file"
            className="mt-6 flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 cursor-pointer bg-muted/10 rounded-none"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, handleOcrFile)}
          >
            {isOcrProcessing ? (
              <Loader2 className="w-10 h-10 mb-3 animate-spin" />
            ) : (
              <Upload className="w-10 h-10 mb-3" />
            )}

            <span className="text-xs font-black uppercase">
              Click para capturar
            </span>
            <span className="text-xs text-muted-foreground mt-2">
              .PDF, .JPG, .PNG, .WEBP
            </span>

            <input
              id="ocr-file"
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleOcrFile(file);
                e.target.value = "";
              }}
            />
          </label>

          {ocrResult && (
            <div
              className={`mt-4 border p-4 text-xs uppercase font-bold flex gap-3 rounded-none ${ocrResult.success
                  ? "text-green-500 border-green-500/30"
                  : "text-red-500 border-red-500/30"
                }`}
            >
              {ocrResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}

              <div>
                <p>{ocrResult.msg}</p>

                {ocrResult.reasons?.length > 0 && (
                  <ul className="mt-2 list-disc pl-4">
                    {ocrResult.reasons.map((reason: string) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}

                {ocrResult.candidateId && (
                  <a
                    href={`/es/dashboard/candidates/${ocrResult.candidateId}`}
                    className="underline mt-2 inline-block"
                  >
                    Open candidate profile
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {reviewFile && (
        <section className="border-2 border-amber-500/40 p-6 rounded-none">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-black uppercase tracking-widest">
                Manual Document Review
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                OCR could not create the candidate safely. Review the uploaded
                document and confirm the fields below.
              </p>
            </div>

            <a
              href={reviewFile.url}
              target="_blank"
              rel="noreferrer"
              className="border px-4 py-2 text-xs font-black uppercase flex items-center gap-2 rounded-none"
            >
              <ExternalLink className="h-4 w-4" />
              Open File
            </a>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {manualFields.map(([key, label, type]) => (
              <div key={key} className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground">
                  {label}
                </label>
                <input
                  type={type}
                  value={manualForm[key]}
                  onChange={(e) => updateManual(key, e.target.value)}
                  className="w-full border bg-background px-3 py-2 text-sm rounded-none"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground">
              MRZ Raw
            </label>
            <textarea
              value={manualForm.mrzRaw}
              onChange={(e) => updateManual("mrzRaw", e.target.value)}
              className="w-full border bg-background px-3 py-2 text-sm h-20 rounded-none font-mono"
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground">
              Observations
            </label>
            <textarea
              value={manualForm.observations}
              onChange={(e) => updateManual("observations", e.target.value)}
              className="w-full border bg-background px-3 py-2 text-sm h-24 rounded-none"
            />
          </div>

          {extractedTextPreview && (
            <details className="mt-4 border p-4 rounded-none">
              <summary className="text-xs font-black uppercase cursor-pointer">
                OCR Raw Text Preview
              </summary>
              <pre className="mt-4 text-xs whitespace-pre-wrap opacity-70">
                {extractedTextPreview}
              </pre>
            </details>
          )}

          <button
            onClick={submitManualReview}
            disabled={isOcrProcessing}
            className="mt-6 border px-6 py-3 text-xs font-black uppercase rounded-none"
          >
            {isOcrProcessing
              ? "Saving..."
              : "Create Candidate From Reviewed Document"}
          </button>
        </section>
      )}
    </div>
  );
}