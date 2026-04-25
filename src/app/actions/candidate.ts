"use server";

import prisma from "@/lib/prisma";
import { candidateSchema, type CandidateFormData } from "@/schemas/candidate";
import { revalidatePath } from "next/cache";

export async function createCandidate(data: CandidateFormData) {
  const validated = candidateSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, error: "Invalid data" };
  }

  const parsed = validated.data;

  const email = parsed.email.trim().toLowerCase();
  const phone = parsed.phone.trim();

  try {
    const existing = await prisma.candidate.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existing) {
      if (existing.email === email) {
        return { success: false, error: "Email already registered" };
      }

      if (existing.phone === phone) {
        return { success: false, error: "Phone already registered" };
      }

      return { success: false, error: "Candidate already exists" };
    }

    const candidate = await prisma.candidate.create({
      data: {
        firstName: parsed.firstName,
        middleName: parsed.middleName || null,
        lastName: parsed.lastName,
        email,
        phone,
        dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
        placeOfBirth: parsed.placeOfBirth || null,
        countryOfBirth: parsed.countryOfBirth || null,
        citizenship: parsed.citizenship || null,
        nationality: parsed.nationality || null,
        sex: parsed.sex || null,
        maritalStatus: parsed.maritalStatus || null,
        education: parsed.education || null,
        estimatedArrival: parsed.estimatedArrival
          ? new Date(parsed.estimatedArrival)
          : null,
        needsHousing: parsed.needsHousing ?? false,
        observations: parsed.observations || null,
        consentContact: parsed.consentContact ?? false,
        consentRecruitment: parsed.consentRecruitment ?? false,
        status: "NEW",
      },
    });

    await prisma.statusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: "NEW",
        toStatus: "NEW",
        changedBy: "SYSTEM",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_CANDIDATE",
        entity: "Candidate",
        entityId: candidate.id,
        details: {
          email: candidate.email,
          phone: candidate.phone,
          source: "Public Form",
        },
      },
    });

    revalidatePath("/[locale]/dashboard/candidates", "page");
    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/", "layout");

    return { success: true, id: candidate.id };
  } catch (error) {
    console.error("Failed to create candidate:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Database error",
    };
  }
}

export async function deleteCandidate(id: string) {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });

    await prisma.candidate.delete({
      where: { id },
    });

    if (candidate) {
      await prisma.auditLog.create({
        data: {
          action: "DELETE_CANDIDATE",
          entity: "Candidate",
          entityId: id,
          details: {
            name: `${candidate.firstName} ${candidate.lastName}`,
            email: candidate.email,
            phone: candidate.phone,
          },
        },
      });
    }

    revalidatePath("/[locale]/dashboard/candidates", "page");
    revalidatePath("/[locale]/dashboard/candidates/[id]", "page");
    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete candidate:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Database error",
    };
  }
}