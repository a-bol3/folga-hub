import { DocumentsImportView } from "@/components/dashboard/documents-import-view";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter">Documentos & Importación</h1>
        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-[0.2em] mt-1">
          Ingesta Masiva de Candidatos y OCR Engine
        </p>
      </div>

      <DocumentsImportView />
    </div>
  );
}
