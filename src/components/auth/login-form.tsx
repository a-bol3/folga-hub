"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ArrowRight, Lock, Loader2, AlertCircle, UserPlus, LogIn } from "lucide-react";
import { login, signUp } from "@/app/actions/auth";

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    try {
      const action = mode === 'login' ? login : signUp;
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
        setIsPending(false);
      }
    } catch (err) {
      setError("Error de conexión o fallo del servidor");
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form action={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase flex items-center gap-2 animate-in fade-in zoom-in duration-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Email Corporativo</label>
            <div className="relative">
              <Input 
                name="email"
                type="email" 
                required
                placeholder="admin@folga.pl" 
                className="pl-10 bg-zinc-900/50 border-zinc-800 text-white h-12 rounded-none focus:border-violet-500 transition-colors"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Contraseña</label>
            <div className="relative">
              <Input 
                name="password"
                type="password" 
                required
                placeholder="••••••••" 
                className="pl-10 bg-zinc-900/50 border-zinc-800 text-white h-12 rounded-none focus:border-violet-500 transition-colors"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock className="h-4 w-4" />
              </div>
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Rol Administrativo</label>
              <select 
                name="role"
                className="w-full h-12 bg-zinc-900/50 border border-zinc-800 text-white px-4 text-sm font-bold uppercase tracking-widest focus:border-violet-500 outline-none transition-colors"
              >
                <option value="ADMIN">Super Admin (Control Total)</option>
                <option value="RECRUITER">Reclutador (Gestión de Candidatos)</option>
                <option value="VIEWER">Visualizador (Solo Lectura)</option>
              </select>
            </div>
          )}
        </div>

        <Button 
          type="submit"
          disabled={isPending}
          size="lg" 
          className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-widest text-xs transition-all rounded-none"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="flex items-center gap-2">
              {mode === 'login' ? 'Entrar al Dashboard' : 'Crear Cuenta Administradora'}
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <div className="text-center">
        <button 
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          {mode === 'login' ? (
            <>
              <UserPlus className="h-3 w-3" />
              ¿No tiene cuenta? Registrarse ahora
            </>
          ) : (
            <>
              <LogIn className="h-3 w-3" />
              ¿Ya tiene cuenta? Iniciar sesión
            </>
          )}
        </button>
      </div>
    </div>
  );
}
