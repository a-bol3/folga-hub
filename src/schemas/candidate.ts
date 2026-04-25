import { z } from "zod";

export const candidateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required"),
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  countryOfBirth: z.string().optional(),
  citizenship: z.string().optional(),
  nationality: z.string().optional(),
  sex: z.string().optional(),
  maritalStatus: z.string().optional(),
  education: z.string().optional(),
  estimatedArrival: z.string().optional(),
  needsHousing: z.boolean().default(false),
  observations: z.string().optional(),
  consentContact: z.boolean().refine((val) => val === true, {
    message: "You must consent to be contacted",
  }),
  consentRecruitment: z.boolean().refine((val) => val === true, {
    message: "You must consent to recruitment processing",
  }),
});

export type CandidateFormData = z.infer<typeof candidateSchema>;
