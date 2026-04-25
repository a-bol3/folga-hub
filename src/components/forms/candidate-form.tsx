"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { candidateSchema, type CandidateFormData } from "@/schemas/candidate";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, Upload, Loader2, FileText } from "lucide-react";
import { createCandidate } from "@/app/actions/candidate";
import { uploadCandidateDocument } from "@/app/actions/documents";
import { useRouter } from "@/i18n/navigation";
import { FileUploader } from "@/components/uploads/file-uploader";

export function CandidateForm({ returnUrl }: { returnUrl?: string }) {
  const t = useTranslations("CandidateForm");
  const commonT = useTranslations("Common");
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const router = useRouter();
  const totalSteps = 4;

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      needsHousing: false,
      consentContact: false,
      consentRecruitment: false,
    },
  });

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ["firstName", "lastName", "email", "phone"];
    if (step === 2) fieldsToValidate = ["dateOfBirth", "placeOfBirth", "citizenship"];
    
    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) setStep((s) => Math.min(s + 1, totalSteps));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const onSubmit = async (data: CandidateFormData) => {
    setError(null);
    const result = await createCandidate(data);
    
    if (result.success && result.id) {
      // Handle File Upload if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        await uploadCandidateDocument(result.id, formData);
      }
      if (returnUrl) {
        router.push(returnUrl as any);
      } else {
        router.push("/apply/success");
      }
    } else {
      setError(result.error || "Something went wrong");
    }
  };

  return (
    <Card className="max-w-2xl mx-auto border-2">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex justify-between items-center mb-4">
          <Badge variant="outline" className="uppercase tracking-widest px-3 py-1">
            Step {step} / {totalSteps}
          </Badge>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 w-8 ${i <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
        <CardTitle className="text-2xl uppercase font-black">{t("title")}</CardTitle>
        <CardDescription>
          {step === 1 && t("personalInfo")}
          {step === 2 && t("details")}
          {step === 3 && t("documents")}
          {step === 4 && "Confirmación Final"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase">{t("firstName")}</label>
                  <Input {...register("firstName")} />
                  {errors.firstName && <span className="text-xs text-destructive">{errors.firstName.message}</span>}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase">{t("lastName")}</label>
                  <Input {...register("lastName")} />
                  {errors.lastName && <span className="text-xs text-destructive">{errors.lastName.message}</span>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">{t("email")}</label>
                <Input type="email" {...register("email")} />
                {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">{t("phone")}</label>
                <Input {...register("phone")} />
                {errors.phone && <span className="text-xs text-destructive">{errors.phone.message}</span>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase">{t("dob")}</label>
                  <Input type="date" {...register("dateOfBirth")} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase">{t("pob")}</label>
                  <Input {...register("placeOfBirth")} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase">{t("citizenship")}</label>
                <Input {...register("citizenship")} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <FileUploader 
                label="Currículum Vitae (CV)" 
                onFileSelect={setSelectedFile} 
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-4 border p-4 bg-muted/20">
                <div className="flex items-start space-x-2">
                  <input type="checkbox" id="consentContact" {...register("consentContact")} className="mt-1" />
                  <label htmlFor="consentContact" className="text-xs font-medium leading-tight">
                    Doy mi consentimiento para ser contactado por FOLGA en relación con esta solicitud.
                  </label>
                </div>
                {errors.consentContact && <p className="text-xs text-destructive">{errors.consentContact.message}</p>}
                
                <div className="flex items-start space-x-2">
                  <input type="checkbox" id="consentRecruitment" {...register("consentRecruitment")} className="mt-1" />
                  <label htmlFor="consentRecruitment" className="text-xs font-medium leading-tight">
                    Doy mi consentimiento para el procesamiento de mis datos personales de acuerdo con la política de privacidad y GDPR/RODO.
                  </label>
                </div>
                {errors.consentRecruitment && <p className="text-xs text-destructive">{errors.consentRecruitment.message}</p>}
              </div>
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-xs font-bold uppercase">
                  {error}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-6 border-t mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              className={step === 1 ? "invisible" : ""}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              {t("previous")}
            </Button>
            
            {step < totalSteps ? (
              <Button type="button" onClick={nextStep}>
                {t("next")}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? commonT("loading") : t("submit")}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
