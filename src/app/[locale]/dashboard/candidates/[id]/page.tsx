import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Briefcase, 
  FileText, 
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  MessageSquare,
  FileUp
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StatusSelector } from "@/components/dashboard/status-selector";
import { NotesSection } from "@/components/dashboard/notes-section";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      documents: true,
      notes: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
      history: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!candidate) {
    notFound();
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
          <Link href="/dashboard/candidates">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            {candidate.firstName} {candidate.lastName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="border-primary uppercase text-[9px] font-black">
              {candidate.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              ID: {candidate.id.split("-")[0]}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Personal Data */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-2">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <User className="h-4 w-4" />
                Información de Perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <DataField label="Email" value={candidate.email} icon={Mail} />
                <DataField label="Teléfono" value={candidate.phone} icon={Phone} />
                <DataField label="Fecha Nacimiento" value={candidate.dateOfBirth ? format(candidate.dateOfBirth, "dd/MM/yyyy") : "N/A"} icon={Calendar} />
                <DataField label="Lugar Nacimiento" value={candidate.placeOfBirth || "N/A"} icon={MapPin} />
                <DataField label="Ciudadanía" value={candidate.citizenship || "N/A"} icon={Shield} />
                <DataField label="Educación" value={candidate.education || "N/A"} icon={Briefcase} />
                <div className="md:col-span-2 p-4 border-t">
                  <label className="text-[10px] font-black uppercase text-muted-foreground block mb-2">Observaciones</label>
                  <p className="text-sm">{candidate.observations || "Sin observaciones adicionales."}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="border-b bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentación Adjunta
              </CardTitle>
              <Button size="sm" variant="outline" className="h-8 font-bold uppercase text-[10px]">
                <FileUp className="mr-2 h-3 w-3" />
                Check Storage
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {candidate.documents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs font-bold uppercase">
                  No hay documentos registrados.
                </div>
              ) : (
                <div className="divide-y">
                  {candidate.documents.map((doc) => (
                    <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-muted border border-border flex items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold uppercase truncate max-w-[200px]">{doc.fileName}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{doc.type} &bull; {(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 font-black uppercase text-[10px]">
                        Ver Archivo
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notas Internas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {candidate.notes.map((note) => (
                  <div key={note.id} className="border p-4 bg-muted/10 relative">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                        {note.user.email}
                      </span>
                      <span className="text-[9px] text-muted-foreground uppercase">
                        {format(note.createdAt, "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
                <NotesSection candidateId={candidate.id} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Actions & History */}
        <div className="space-y-6">
          <Card className="border-2 border-primary">
            <CardHeader className="border-b bg-primary text-primary-foreground">
              <CardTitle className="text-xs font-black uppercase tracking-widest">Pipeline de Reclutación</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <StatusSelector 
                candidateId={candidate.id} 
                currentStatus={candidate.status} 
              />
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Historial de Cambios
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {candidate.history.map((entry) => (
                  <div key={entry.id} className="flex gap-3 text-xs">
                    <div className="mt-1 h-1.5 w-1.5 bg-primary shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold">
                        {entry.fromStatus} <ChevronRight className="inline h-3 w-3 mx-1" /> {entry.toStatus}
                      </span>
                      <span className="text-[9px] text-muted-foreground uppercase">
                        {format(entry.createdAt, "dd/MM/yyyy HH:mm")} &bull; {entry.changedBy}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DataField({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="p-4 border-b border-r last:border-r-0 odd:border-r">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</span>
      </div>
      <div className="text-sm font-bold truncate">{value}</div>
    </div>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}
