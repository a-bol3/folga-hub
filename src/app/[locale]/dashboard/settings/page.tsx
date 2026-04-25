import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter">Ajustes Generales</h1>
        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-[0.2em] mt-1">
          Configuración del sistema y roles de usuario
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-border">
          <CardHeader>
            <CardTitle className="font-black uppercase tracking-widest text-lg">Cuenta</CardTitle>
            <CardDescription>Preferencias de tu perfil administrador.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center bg-muted/20 p-4 border">
              <div>
                <p className="text-sm font-bold uppercase tracking-tight">Email</p>
                <p className="text-xs text-muted-foreground">admin@folga.pl</p>
              </div>
              <Button variant="outline" size="sm" className="font-bold uppercase text-[10px]">Modificar</Button>
            </div>
            <div className="flex justify-between items-center bg-muted/20 p-4 border">
              <div>
                <p className="text-sm font-bold uppercase tracking-tight">Contraseña</p>
                <p className="text-xs text-muted-foreground">Último cambio hace 30 días</p>
              </div>
              <Button variant="outline" size="sm" className="font-bold uppercase text-[10px]">Actualizar</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardHeader>
            <CardTitle className="font-black uppercase tracking-widest text-lg">Base de Datos</CardTitle>
            <CardDescription>Conexión y backups de los datos de FOLGA Hub.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center bg-muted/20 p-4 border border-primary/20">
              <div>
                <p className="text-sm font-bold uppercase tracking-tight text-primary">Estado de Conexión</p>
                <p className="text-xs text-muted-foreground">PostgreSQL Conectado (Local)</p>
              </div>
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
            </div>
            <Button variant="destructive" className="w-full font-black uppercase text-[10px] tracking-widest">
              Limpiar Base de Datos (Danger)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
