"use client";

import { useState } from "react";
import { Upload, FileDown, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { importCandidatesFromExcel, extractCandidateFromOCR } from "@/app/actions/import";

export function DocumentsImportView() {
  const [isUploading, setIsUploading] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; msg?: string } | null>(null);
  const [ocrResult, setOcrResult] = useState<{ success: boolean; msg: string; error?: string } | null>(null);

  const handleFile = async (file: File, type: 'excel' | 'ocr') => {
    if (type === 'excel') {
      setIsUploading(true);
      setResult(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await importCandidatesFromExcel(formData);
        if (response.success) {
          setResult({ success: response.createdCount, errors: response.errors, msg: response.msg });
        } else {
          setResult({ success: 0, errors: 1, msg: response.error });
        }
      } catch (error) {
        setResult({ success: 0, errors: 1, msg: `Critical Failure: ${error instanceof Error ? error.message : "Unknown"}` });
      } finally {
        setIsUploading(false);
      }
    } else {
      setIsOcrProcessing(true);
      setOcrResult(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await extractCandidateFromOCR(formData);
        if (response.success) {
          setOcrResult({ success: true, msg: response.msg || "" });
        } else {
          setOcrResult({ success: false, msg: response.error || "OCR Failed" });
        }
      } catch (error) {
        setOcrResult({ success: false, msg: `Critical Failure: ${error instanceof Error ? error.message : "Unknown"}` });
      } finally {
        setIsOcrProcessing(false);
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent, type: 'excel' | 'ocr') => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file, type);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file, 'excel');
      event.target.value = "";
    }
  };

  const handleOcrUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file, 'ocr');
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-dashed border-primary/50 relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors pointer-events-none" />
          <CardHeader>
            <CardTitle className="font-black uppercase tracking-widest text-lg flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              Importar Excel / CSV
            </CardTitle>
            <CardDescription>Cargue una base de datos de candidatos pre-existente para crear perfiles automáticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="dropzone-file"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-muted/10 hover:bg-muted/30 transition-colors"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, 'excel')}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isUploading ? (
                    <Loader2 className="w-10 h-10 mb-3 text-primary animate-spin" />
                  ) : (
                    <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  )}
                  <p className="mb-2 text-sm text-gray-500 font-bold uppercase"><span className="text-primary">Click para buscar</span> o arrastrar Excel</p>
                  <p className="text-xs text-gray-500">.XLSX, .XLS, .CSV</p>
                </div>
                <input
                  id="dropzone-file"
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>

            {result && (
              <div className={`p-4 text-xs font-bold uppercase flex items-start gap-2 ${result.success > 0 ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                {result.success > 0 ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <div>
                  <p>{result.msg || "Proceso Finalizado"}</p>
                  <p className="text-[10px] mt-1 opacity-80">Creados: {result.success} | Fallos: {result.errors}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OCR Section */}
        <Card className="border-2 border-border group relative overflow-hidden">
          <div className="absolute inset-0 bg-secondary/5 group-hover:bg-secondary/10 transition-colors pointer-events-none" />
          <CardHeader>
            <CardTitle className="font-black uppercase tracking-widest text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              OCR Documentos de Identidad
            </CardTitle>
            <CardDescription>Karta Pobytu, Pasaportes y PESEL. Creación automática mediante Engine AI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="ocr-file"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-muted/10 hover:bg-muted/30 transition-colors"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, 'ocr')}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isOcrProcessing ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-10 h-10 mb-3 text-secondary animate-spin" />
                      <p className="text-secondary text-[10px] font-black uppercase tracking-widest animate-pulse">Analizando Documento...</p>
                    </div>
                  ) : (
                    <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  )}

                  {!isOcrProcessing && (
                    <>
                      <p className="mb-2 text-sm text-gray-500 font-bold uppercase"><span className="text-secondary">Click para Capturar</span></p>
                      <p className="text-xs text-gray-500">.PDF, .JPG, .PNG</p>
                    </>
                  )}
                </div>
                <input
                  id="ocr-file"
                  type="file"
                  className="hidden"
                  accept=".pdf, .jpg, .jpeg, .png"
                  onChange={handleOcrUpload}
                  disabled={isOcrProcessing}
                />
              </label>
            </div>

            {ocrResult && (
              <div className={`p-4 text-xs font-bold uppercase flex items-start gap-2 ${ocrResult.success ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                {ocrResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <div>
                  <p>{ocrResult.msg}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
