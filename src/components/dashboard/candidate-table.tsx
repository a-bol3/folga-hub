"use client";

import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Layers, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CandidateActions } from "@/components/dashboard/candidate-actions";
import { format } from "date-fns";
import { bulkDeleteCandidates } from "@/app/actions/import";
import { useRouter } from "next/navigation";

export function CandidateTable({ candidates }: { candidates: any[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const toggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} candidatos?`)) return;

    setIsDeleting(true);
    const result = await bulkDeleteCandidates(selectedIds);
    setIsDeleting(false);

    if (result.success) {
      setSelectedIds([]);
      router.refresh();
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-xs font-bold uppercase text-destructive">
            {selectedIds.length} candidatos seleccionados
          </p>
          <Button 
            variant="destructive" 
            size="sm" 
            className="h-8 font-black uppercase text-[10px]"
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-3 w-3" />
            {isDeleting ? "Eliminando..." : "Eliminar en Bloque"}
          </Button>
        </div>
      )}

      <div className="border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={selectedIds.length === candidates.length && candidates.length > 0} 
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[300px] font-black uppercase text-[10px]">Candidato</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Estado</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Contact</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Docs</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Fecha Registro</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-muted-foreground uppercase text-xs font-bold">
                  No se encontraron candidatos.
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((candidate) => (
                <TableRow key={candidate.id} className="group">
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={selectedIds.includes(candidate.id)} 
                      onCheckedChange={() => toggleSelect(candidate.id)}
                    />
                  </TableCell>
                  <TableCell className="font-bold py-4">
                    <div className="flex flex-col">
                      <span className="uppercase tracking-tight">{candidate.firstName} {candidate.lastName}</span>
                      <span className="text-[10px] text-muted-foreground font-normal lowercase">{candidate.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase px-2 py-0 border-primary/30">
                      {candidate.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{candidate.phone}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <Layers className="h-3 w-3" />
                      {candidate._count?.documents || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(candidate.createdAt), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20 hover:text-primary border-0 mr-1">
                      <Link href={`/dashboard/candidates/${candidate.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <CandidateActions id={candidate.id} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
