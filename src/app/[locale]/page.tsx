import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ArrowRight, UserPlus, ShieldCheck } from "lucide-react";

export default async function HomePage() {
  const t = await getTranslations("Common");

  return (
    <div className="flex min-h-[calc(100-vh-64px)] flex-col items-center justify-center py-12 px-4 text-center">
      <div className="max-w-3xl space-y-6">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-6xl uppercase">
          FOLGA Candidate Hub
        </h1>
        <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl">
          Sistemas internos de captación y gestión de talento. Operaciones globales, diseño suizo.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-8">
          <Button asChild size="lg" className="h-12 border-0 bg-primary px-8">
            <Link href="/apply" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t("apply")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-8">
            <Link href="/login" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t("dashboard")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-20 grid w-full max-w-5xl grid-cols-1 gap-0 border border-border md:grid-cols-3">
        <div className="border-b md:border-b-0 md:border-r p-8 text-left">
          <h3 className="font-bold uppercase tracking-tight mb-2">Centralización</h3>
          <p className="text-sm text-muted-foreground">Todos los candidatos en una única fuente de verdad transaccional.</p>
        </div>
        <div className="border-b md:border-b-0 md:border-r p-8 text-left">
          <h3 className="font-bold uppercase tracking-tight mb-2">Auditoría</h3>
          <p className="text-sm text-muted-foreground">Trazabilidad completa de cambios de estado y acciones internas.</p>
        </div>
        <div className="p-8 text-left">
          <h3 className="font-bold uppercase tracking-tight mb-2">Exportación</h3>
          <p className="text-sm text-muted-foreground">Salida operativa a Excel/CSV con un solo clic para reportes técnicos.</p>
        </div>
      </div>
    </div>
  );
}
