import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function ApplySuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 text-center">
      <div className="max-w-lg space-y-8">
        <div className="mx-auto h-20 w-20 border-2 border-primary flex items-center justify-center">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tighter">
          Solicitud Enviada
        </h1>
        <p className="text-muted-foreground">
          Su solicitud ha sido registrada correctamente en el sistema FOLGA.
          Nuestro equipo de reclutamiento revisará su perfil y se pondrá en
          contacto con usted en las próximas 48-72 horas.
        </p>
        <div className="border-t pt-8">
          <Button asChild variant="outline" className="border-2">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
