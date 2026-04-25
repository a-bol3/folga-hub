"use server";

import prisma from "@/lib/prisma";
import { candidateSchema, type CandidateFormData } from "@/schemas/candidate";
import { revalidatePath } from "next/cache";

export async function createCandidate(data: CandidateFormData) {
  // Validate data
  const validated = candidateSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: "Invalid data" };
  }

  const { email, phone } = validated.data;

  try {
    // 1. Deduplication Logic
    const existing = await prisma.candidate.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existing) {
      // Logic: Flag as potential duplicate but allow storage (or block)
      // Per requirements: "evitar la creación de duplicados"
      // I will block the automatic creation if the email matches exactly for safety.
      if (existing.email === email) {
        return { success: false, error: "Email already registered" };
      }
    }

    // 2. Create Candidate
    const candidateData: any = {
      ...validated.data,
      dateOfBirth: validated.data.dateOfBirth ? new Date(validated.data.dateOfBirth) : null,
      estimatedArrival: validated.data.estimatedArrival ? new Date(validated.data.estimatedArrival) : null,
      status: "NEW",
    };
    const candidate = await prisma.candidate.create({
      data: candidateData,
    });

    // 3. Status History Entry
    await prisma.statusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: "NEW",
        toStatus: "NEW",
        changedBy: "SYSTEM",
      },
    });

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        action: "CREATE_CANDIDATE",
        entity: "Candidate",
        entityId: candidate.id,
        details: { email: candidate.email, source: "Public Form" },
      },
    });

    revalidatePath("/candidates");
    return { success: true, id: candidate.id };
  } catch (error) {
    console.error("Failed to create candidate:", error);
    return { success: false, error: "Database error" };
  }
}

export async function deleteCandidate(id: string) {
  try {
    // 1. Audit Log of deletion
    const candidate = await prisma.candidate.findUnique({ where: { id } });
    
    await prisma.candidate.delete({
      where: { id }
    });

    if (candidate) {
      await prisma.auditLog.create({
        data: {
          action: "DELETE_CANDIDATE",
          entity: "Candidate",
          entityId: id,
          details: { name: `${candidate.firstName} ${candidate.lastName}`, email: candidate.email },
        },
      });
    }

    revalidatePath("/[locale]/dashboard/candidates", "page");
    revalidatePath("/[locale]/dashboard/candidates/[id]", "page");
    revalidatePath("/", "layout");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to delete candidate:", error);
    return { success: false, error: error instanceof Error ? error.message : "Database error" };
  }
}
