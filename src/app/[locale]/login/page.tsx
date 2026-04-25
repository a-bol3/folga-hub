import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ArrowRight, Lock } from "lucide-react";

export default async function LoginPage() {
  const t = await getTranslations("Common");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-black text-white">
      {/* Visual Section - Glassmorphism Graphic */}
      <div className="relative hidden lg:block overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-indigo-900/20 to-black z-10" />
        <img 
          src="/login-bg.png" 
          alt="Abstract 3D Shape" 
          className="absolute inset-0 object-cover w-full h-full opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20" />
        <div className="relative z-30 p-12 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white text-black flex items-center justify-center font-black text-xl tracking-tighter">
                F
              </div>
              <span className="font-black uppercase tracking-widest text-lg">Folga</span>
            </div>
          </div>
          <div>
            <h2 className="text-5xl font-black uppercase tracking-tighter mb-4 leading-tight">
              Industrial <br /> Strength <br /> Recruitment
            </h2>
            <p className="text-zinc-400 font-medium max-w-sm">
              Inicie sesión para acceder al panel de control de captación y gestión operativa de talento global.
            </p>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex items-center justify-center p-8 sm:p-12">
        <div className="mx-auto w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-black uppercase tracking-tighter">Acceso Seguro</h1>
            <p className="mt-2 text-zinc-400 text-sm">
              Ingrese sus credenciales de administrador
            </p>
          </div>

          <LoginForm />

            <p className="text-center text-xs text-zinc-500 uppercase tracking-widest pt-4">
              &copy; {new Date().getFullYear()} Folga Recruitment
            </p>
        </div>
      </div>
    </div>
  );
}

import { LoginForm } from "@/components/auth/login-form";
