import { CandidateForm } from "@/components/forms/candidate-form";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function NewCandidatePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
          <Link href="/dashboard/candidates">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            Nuevo Candidato
          </h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
            Reclutamiento Manual - Backoffice
          </p>
        </div>
      </div>

      <div className="max-w-4xl pt-4">
        <CandidateForm returnUrl="/dashboard/candidates" />
      </div>
    </div>
  );
}
