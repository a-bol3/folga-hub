import { 
  Download, 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CandidateSearch } from "@/components/dashboard/candidate-search";
import { CandidateTable } from "@/components/dashboard/candidate-table";

async function getCandidatesData(options: {
  search?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  try {
    const prisma = (await import("@/lib/prisma")).default;
    const where: any = {};
    
    if (options.search) {
      where.OR = [
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } }
      ];
    }
    
    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }

    const [total, items] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        take: options.limit,
        skip: (options.page - 1) * options.limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { documents: true } }
        }
      })
    ]);

    return { total, items };
  } catch {
    return { total: 0, items: [] };
  }
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function CandidatesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search as string) || "";
  const status = (params.status as string) || "ALL";
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 50;

  const { total, items: candidates } = await getCandidatesData({ 
    search, 
    status, 
    page, 
    limit 
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Candidate Database</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-[0.2em] mt-1">
            Gestión de perfiles y pipeline técnico
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <Button asChild variant="outline" className="font-bold uppercase text-[10px] h-10 border-2">
              <a href="/api/export/candidates?format=csv" target="_blank">
                <Download className="mr-2 h-3 w-3" />
                CSV
              </a>
            </Button>
            <Button asChild variant="outline" className="font-bold uppercase text-[10px] h-10 border-2">
              <a href="/api/export/candidates?format=xlsx" target="_blank">
                <Download className="mr-2 h-3 w-3" />
                XLSX
              </a>
            </Button>
          </div>
          <Button asChild className="font-bold uppercase text-xs h-10 bg-primary">
            <Link href="/dashboard/candidates/new">Manual Create</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 border bg-muted/20 items-end">
        <div className="flex-1">
          <CandidateSearch />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">Show:</span>
          {[10, 50, 100, 200, 500, 1000].map((l) => (
            <Button 
              key={l}
              asChild
              variant={limit === l ? "default" : "outline"}
              className="h-8 w-12 text-[10px] font-black p-0"
            >
              <Link href={`?limit=${l}&search=${search}&status=${status}`}>{l}</Link>
            </Button>
          ))}
        </div>
      </div>

      <CandidateTable candidates={candidates} />

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">
          Mostrando {candidates.length} de {total} registros
        </p>
        
        <div className="flex items-center gap-1">
          <Button 
            asChild 
            variant="outline" 
            className="h-8 px-3 text-[10px] font-black uppercase"
          >
            <Link href={`?page=${Math.max(1, page - 1)}&limit=${limit}&search=${search}&status=${status}`}>Prev</Link>
          </Button>
          
          <div className="flex items-center gap-1 px-4">
            <span className="text-xs font-black">{page}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs text-muted-foreground">{totalPages || 1}</span>
          </div>

          <Button 
            asChild 
            variant="outline" 
            className="h-8 px-3 text-[10px] font-black uppercase"
          >
            <Link href={`?page=${Math.min(totalPages, page + 1)}&limit=${limit}&search=${search}&status=${status}`}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
