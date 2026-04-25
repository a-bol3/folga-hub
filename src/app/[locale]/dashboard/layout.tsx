import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { 
  Users, 
  LayoutDashboard, 
  FileText, 
  Settings, 
  LogOut, 
  Menu,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const commonT = await getTranslations("Common");
  const { locale } = await params;

  const navItems = [
    { href: `/dashboard`, label: commonT("dashboard"), icon: LayoutDashboard },
    { href: `/dashboard/candidates`, label: commonT("candidates"), icon: Users },
    { href: `/dashboard/documents`, label: commonT("documents"), icon: FileText },
    { href: `/dashboard/settings`, label: commonT("settings"), icon: Settings },
  ];

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const initials = user?.email?.substring(0, 2).toUpperCase() || "??";

  return (
    <div className="relative flex min-h-screen bg-transparent text-foreground">
      {/* Visual Background - Glassmorphism Graphic */}
      <div className="fixed inset-0 overflow-hidden bg-[#050011] pointer-events-none z-[-1]">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-indigo-900/10 to-[#0F0A1A] z-10" />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[8px] z-20" />
      </div>

      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-black/40 backdrop-blur-xl hidden md:flex flex-col">
        <div className="h-16 border-b flex items-center px-6">
          <span className="font-black uppercase tracking-tighter text-xl">FOLGA</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-bold uppercase tracking-tight hover:bg-muted transition-colors border-l-2 border-transparent hover:border-primary"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <form action={logout}>
             <Button type="submit" variant="ghost" className="w-full justify-start gap-3 px-3 font-bold uppercase text-xs">
                <LogOut className="h-4 w-4" />
                {commonT("logout")}
             </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-0">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="font-bold uppercase tracking-tight">System / Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Connected</p>
              <p className="text-[9px] text-muted-foreground truncate max-w-[150px]">{user?.email}</p>
            </div>
            <div className="h-8 w-8 bg-muted border border-border flex items-center justify-center font-bold text-xs uppercase text-primary">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
