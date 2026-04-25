import { CandidateForm } from "@/components/forms/candidate-form";
import { getTranslations } from "next-intl/server";

export default async function ApplyPage() {
  const t = await getTranslations("CandidateForm");

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex flex-col items-center mb-12 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter sm:text-5xl mb-4">
          FOLGA Recruitment
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Complete el siguiente formulario para iniciar su proceso de captación.
          Sus datos serán procesados con absoluta confidencialidad.
        </p>
      </div>

      <CandidateForm />

      <footer className="mt-20 text-center text-xs text-muted-foreground uppercase tracking-widest border-t pt-8">
        &copy; {new Date().getFullYear()} FOLGA Candidate Hub &bull; Industrial Strength Recruitment
      </footer>
    </div>
  );
}
