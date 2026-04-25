import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Clock, Layers } from "lucide-react";
import { Link } from "@/i18n/navigation";

async function getStats() {
  try {
    const prisma = (await import("@/lib/prisma")).default;
    const totalCandidates = await prisma.candidate.count();
    const newCandidates = await prisma.candidate.count({ where: { status: "NEW" } });
    const approvedCandidates = await prisma.candidate.count({ where: { status: "APPROVED" } });
    return { totalCandidates, newCandidates, approvedCandidates, connected: true };
  } catch {
    return { totalCandidates: 0, newCandidates: 0, approvedCandidates: 0, connected: false };
  }
}

export default async function DashboardPage() {
  const { totalCandidates, newCandidates, approvedCandidates, connected } = await getStats();

  const stats = [
    { label: "Total Candidates", value: totalCandidates, icon: Users, color: "text-blue-600" },
    { label: "New Entries", value: newCandidates, icon: Clock, color: "text-orange-600" },
    { label: "Approved", value: approvedCandidates, icon: UserCheck, color: "text-green-600" },
    { label: "Documents Hub", value: 0, icon: Layers, color: "text-slate-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter">Resumen Operativo</h1>
        <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest mt-1">
          Estado actual de la red de captación FOLGA
        </p>
      </div>

      {!connected && (
        <div className="border-2 border-orange-500/30 bg-orange-50 dark:bg-orange-950/20 p-4">
          <p className="text-xs font-black uppercase text-orange-700 dark:text-orange-400">
            ⚠ Base de datos no conectada — Configure DATABASE_URL en .env
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 border-l-2 border-primary pl-4 py-1">
                <div className="text-xs font-bold uppercase w-20">Sistema</div>
                <div className="text-sm">Base de datos inicializada correctamente.</div>
              </div>
              <div className="flex items-center gap-4 border-l-2 border-muted pl-4 py-1 text-muted-foreground">
                <div className="text-xs font-bold uppercase w-20">Audit</div>
                <div className="text-sm">Configuración de seguridad activa.</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Atajos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="justify-start font-bold uppercase text-[10px] hover:bg-primary hover:text-primary-foreground border-2">
              <Link href="/dashboard/candidates/new">Nuevo Candidato</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start font-bold uppercase text-[10px] hover:bg-primary hover:text-primary-foreground border-2">
              <a href="/api/export/candidates?format=csv">Exportar CSV</a>
            </Button>
            <Button asChild variant="outline" className="justify-start font-bold uppercase text-[10px] hover:bg-primary hover:text-primary-foreground border-2">
              <Link href="/dashboard/settings">Ver Logs</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start font-bold uppercase text-[10px] hover:bg-primary hover:text-primary-foreground border-2">
              <Link href="/dashboard/documents">Revisión Docs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
