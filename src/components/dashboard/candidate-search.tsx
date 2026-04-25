"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export function CandidateSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) params.set("search", term);
    else params.delete("search");
    startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams);
    if (status && status !== "ALL") params.set("status", status);
    else params.delete("status");
    startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-1 items-center gap-2">
      <div className="relative flex-1">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isPending ? 'animate-pulse text-primary' : ''}`} />
        <Input 
          placeholder="Buscar por nombre o email..." 
          className="pl-10 h-10 border-none bg-transparent focus-visible:ring-0" 
          defaultValue={searchParams.get("search")?.toString()}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      <div className="h-6 w-px bg-border mx-2" />
      <select 
        className="bg-transparent text-[10px] font-bold uppercase outline-none cursor-pointer pr-4"
        defaultValue={searchParams.get("status") || "ALL"}
        onChange={(e) => handleStatusFilter(e.target.value)}
      >
        <option value="ALL" className="bg-card">Todos los Estados</option>
        <option value="NEW" className="bg-card">NEW</option>
        <option value="CONTACTED" className="bg-card">CONTACTED</option>
        <option value="UNDER_REVIEW" className="bg-card">UNDER_REVIEW</option>
        <option value="INTERVIEW" className="bg-card">INTERVIEW</option>
        <option value="APPROVED" className="bg-card">APPROVED</option>
        <option value="REJECTED" className="bg-card">REJECTED</option>
      </select>
    </div>
  );
}
