"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateCandidateStatus } from "@/app/actions/status";
import { CandidateStatus } from "@prisma/client";
import { ArrowRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusSelectorProps {
  candidateId: string;
  currentStatus: CandidateStatus;
}

const statusOptions: CandidateStatus[] = [
  "NEW",
  "CONTACTED",
  "UNDER_REVIEW",
  "INTERVIEW",
  "PENDING_DOCS",
  "APPROVED",
  "REJECTED",
  "HIRED"
];

export function StatusSelector({ candidateId, currentStatus }: StatusSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleStatusChange = async (newStatus: CandidateStatus) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    try {
      await updateCandidateStatus(candidateId, newStatus);
      setShowOptions(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-[9px] font-black uppercase text-muted-foreground">Estado Actual</label>
        <div className="text-xl font-black uppercase tracking-tighter">{currentStatus}</div>
      </div>

      <div className="relative">
        <Button 
          onClick={() => setShowOptions(!showOptions)}
          disabled={isUpdating}
          className="w-full justify-between font-bold uppercase text-[10px] h-10 border-2"
        >
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cambiar Estado"}
          <ArrowRight className="h-3 w-3" />
        </Button>

        {showOptions && (
          <div className="absolute top-full left-0 w-full mt-1 bg-card border-2 z-[99] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={cn(
                  "w-full px-4 py-3 text-left text-[10px] font-bold uppercase transition-colors flex items-center justify-between border-b border-border/30 last:border-0",
                  currentStatus === status 
                    ? "bg-primary/20 text-primary-foreground" 
                    : "text-foreground hover:bg-primary hover:text-primary-foreground"
                )}
              >
                {status === "REJECTED" ? "RECHAZADO" : status}
                {currentStatus === status && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
