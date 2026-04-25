"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addCandidateNote(
  candidateId: string,
  content: string,
  userId: string
) {
  if (!content.trim()) return { success: false, error: "Note cannot be empty" };

  try {
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: "admin@folga.pl"
        }
      });
    }

    const note = await prisma.note.create({
      data: {
        candidateId,
        content,
        userId: user.id,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: "ADD_NOTE",
        entity: "Candidate",
        entityId: candidateId,
        details: { noteId: note.id },
      },
    });

    revalidatePath("/", "layout");
    return { success: true, note };
  } catch (error) {
    console.error("Add note error:", error);
    return { success: false, error: "Failed to add note" };
  }
}
