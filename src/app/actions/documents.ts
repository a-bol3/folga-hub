"use server";

import { createClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role for server-side uploads
);

export async function uploadCandidateDocument(
  candidateId: string,
  file: FormData
) {
  const binary = file.get("file") as File;
  const fileName = `${candidateId}/${Date.now()}-${binary.name}`;

  try {
    // 1. Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("candidates")
      .upload(fileName, binary);

    if (error) throw error;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from("candidates")
      .getPublicUrl(fileName);

    // 3. Register in Database
    const document = await prisma.document.create({
      data: {
        candidateId,
        type: "CV", // Default for now
        fileName: binary.name,
        fileUrl: publicUrl,
        fileSize: binary.size,
        mimeType: binary.type,
      },
    });

    return { success: true, document };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Failed to upload document" };
  }
}
