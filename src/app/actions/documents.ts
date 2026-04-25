"use server";

import { createClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server credentials.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function uploadCandidateDocument(
  candidateId: string,
  formData: FormData
) {
  const file = formData.get("file") as File | null;

  if (!file) {
    return {
      success: false,
      error: "No file received.",
    };
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "candidates";

  try {
    const supabase = getSupabaseAdmin();

    const safeFileName = file.name.replace(/[^\w.\-]/g, "_");
    const storagePath = `${candidateId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return {
        success: false,
        error: "Failed to upload document to storage.",
      };
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    const document = await prisma.document.create({
      data: {
        candidateId,
        type: "CV",
        fileName: file.name,
        fileUrl: publicData.publicUrl,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        status: "ACTIVE",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPLOAD_DOCUMENT",
        entity: "Document",
        entityId: document.id,
        details: {
          candidateId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        },
      },
    });

    return {
      success: true,
      document,
    };
  } catch (error) {
    console.error("Upload document error:", error);

    return {
      success: false,
      error: "Unexpected upload error.",
    };
  }
}