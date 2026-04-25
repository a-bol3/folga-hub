"use client";

import { useState } from "react";
import { MoreHorizontal, Trash, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCandidate } from "@/app/actions/candidate";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";

export function CandidateActions({ id }: { id: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("¿Estás seguro de eliminar a este candidato permanentemente?")) {
      setIsDeleting(true);
      try {
        const res = await deleteCandidate(id);
        if (res.success) {
          router.refresh();
          setIsOpen(false);
        } else {
          alert(`Error al eliminar: ${res.error}`);
        }
      } catch (err) {
        alert(`Fallo crítico: ${err instanceof Error ? err.message : "Error desconocido"}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="relative inline-block text-left">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(!isOpen)}>
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-36 bg-card border border-border/50 z-50 shadow-xl py-1 text-xs font-bold uppercase rounded-none">
            <Link 
              href={`/dashboard/candidates/${id}`}
              className="flex items-center px-4 py-2 hover:bg-primary/20 text-foreground transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Eye className="h-3 w-3 mr-2" />
              Ver Perfil
            </Link>
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full text-left flex items-center px-4 py-2 hover:bg-destructive/20 text-destructive transition-colors"
            >
              <Trash className="h-3 w-3 mr-2" />
              Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
