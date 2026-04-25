"use server";

import prisma from "@/lib/prisma";
import { CandidateStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateCandidateStatus(
  candidateId: string,
  newStatus: CandidateStatus,
  userId?: string
) {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) throw new Error("Candidate not found");

    const oldStatus = candidate.status;

    // 1. Update Candidate
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { status: newStatus },
    });

    // 2. Track History
    await prisma.statusHistory.create({
      data: {
        candidateId,
        fromStatus: oldStatus,
        toStatus: newStatus,
        changedBy: userId || "ADMIN",
      },
    });

    // 3. Audit Log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_STATUS",
        entity: "Candidate",
        entityId: candidateId,
        details: { from: oldStatus, to: newStatus },
      },
    });

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/candidates");
    
    return { success: true };
  } catch (error) {
    console.error("Status update error:", error);
    return { success: false, error: "Failed to update status" };
  }
}
