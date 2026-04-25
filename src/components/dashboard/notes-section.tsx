"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { addCandidateNote } from "@/app/actions/notes";
import { Loader2 } from "lucide-react";

interface NotesSectionProps {
  candidateId: string;
}

export function NotesSection({ candidateId }: NotesSectionProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      // For demo purposes, using a hardcoded user ID. 
      // in production, this would come from the session.
      const userId = "admin-demo-id"; 
      await addCandidateNote(candidateId, content, userId);
      setContent("");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-4 border-t">
      <textarea 
        className="w-full border-2 p-3 text-sm focus:outline-none focus:border-primary bg-transparent placeholder:text-[10px] placeholder:uppercase placeholder:font-black min-h-[100px]" 
        placeholder="Escribir nota interna..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
      />
      <Button 
        onClick={handleSubmit} 
        disabled={isSubmitting || !content.trim()}
        className="mt-2 w-full font-black uppercase text-xs"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Guardar Nota
      </Button>
    </div>
  );
}
