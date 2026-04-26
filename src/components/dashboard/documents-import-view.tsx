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
  extractedTextPreview?: string;
};

export function DocumentsImportView() {
  const [isUploading, setIsUploading] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [reviewFile, setReviewFile] = useState<ReviewFile | null>(null);
  const [manualForm, setManualForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    placeOfBirth: "",
    citizenship: "",
    nationality: "",
    sex: "",
    documentType: "PASSPORT",
    documentNumber: "",
    identityNumber: "",
    issuingCountry: "",
    dateOfIssue: "",
    dateOfExpiry: "",
    observations: "",
  });

  const updateManual = (key: string, value: string) => {
    setManualForm((prev) => ({ ...prev, [key]: value }));
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
    } finally {
      setIsUploading(false);
    }
  };

  const handleOcrFile = async (file: File) => {
    setIsOcrProcessing(true);
    setOcrResult(null);
    setReviewFile(null);

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
        setReviewFile({
          ...response.file,
          extractedTextPreview: response.extractedTextPreview || "",
        });

        setOcrResult({
          success: false,
          review: true,
          msg: "OCR could not extract reliable data. Manual review is ready.",
        });
      } else {
        setOcrResult({
          success: false,
          msg: response.error || "OCR failed.",
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
          ocrText: reviewFile.extractedTextPreview,
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
      } else {
        setOcrResult({
          success: false,
          msg: response.error || "Manual review failed.",
          candidateId: response.candidateId,
        });
      }
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const onDrop = (
    event: React.DragEvent,
    handler: (file: File) => Promise<void>
  ) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handler(file);
  };

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
            <div className="mt-4 border p-4 text-xs uppercase font-bold">
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
            Karta Pobytu, Pasaportes y PESEL. Creación automática mediante
            OCR/manual review.
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
              .PDF, .JPG, .PNG
            </span>
            <input
              id="ocr-file"
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleOcrFile(file);
                e.target.value = "";
              }}
            />
          </label>

          {ocrResult && (
            <div
              className={`mt-4 border p-4 text-xs uppercase font-bold flex gap-3 ${ocrResult.success
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-black uppercase tracking-widest">
                Manual Document Review
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                OCR failed, but the document was uploaded. Fill the fields below
                to create the candidate.
              </p>
            </div>

            <a
              href={reviewFile.url}
              target="_blank"
              rel="noreferrer"
              className="border px-4 py-2 text-xs font-black uppercase flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open File
            </a>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              ["firstName", "First name"],
              ["middleName", "Middle name"],
              ["lastName", "Last name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["dateOfBirth", "Date of birth"],
              ["placeOfBirth", "Place of birth"],
              ["citizenship", "Citizenship"],
              ["nationality", "Nationality"],
              ["sex", "Sex"],
              ["documentType", "Document type"],
              ["documentNumber", "Document number"],
              ["identityNumber", "Identity number"],
              ["issuingCountry", "Issuing country"],
              ["dateOfIssue", "Date of issue"],
              ["dateOfExpiry", "Date of expiry"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground">
                  {label}
                </label>
                <input
                  type={
                    key.toLowerCase().includes("date") ? "date" : "text"
                  }
                  value={(manualForm as any)[key]}
                  onChange={(e) => updateManual(key, e.target.value)}
                  className="w-full border bg-background px-3 py-2 text-sm rounded-none"
                />
              </div>
            ))}
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

          <button
            onClick={submitManualReview}
            disabled={isOcrProcessing}
            className="mt-6 border px-6 py-3 text-xs font-black uppercase rounded-none"
          >
            {isOcrProcessing ? "Saving..." : "Create Candidate From Document"}
          </button>
        </section>
      )}
    </div>
  );
}