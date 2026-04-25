import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { parsePassportMrz } from "@/lib/ocr/mrz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase credentials.");
    }

    return createClient(url, key);
}

async function extractTextFromPdf(buffer: Buffer) {
    try {
        const pdfParseModule = await import("pdf-parse");
        const pdfParse =
            typeof pdfParseModule.default === "function"
                ? pdfParseModule.default
                : (pdfParseModule as any);

        const result = await pdfParse(buffer);
        return result.text || "";
    } catch (error) {
        console.warn("PDF text extraction failed:", error);
        return "";
    }
}

async function extractTextWithTesseract(buffer: Buffer) {
    try {
        const Tesseract = await import("tesseract.js");

        const result = await Tesseract.recognize(buffer, "eng+spa", {
            logger: () => { },
        });

        return result.data.text || "";
    } catch (error) {
        console.error("Tesseract OCR failed:", error);
        return "";
    }
}

function buildCandidateEmail(parsed: {
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
}) {
    const raw = [
        parsed.firstName || "unknown",
        parsed.lastName || "candidate",
        parsed.documentNumber || crypto.randomUUID(),
    ]
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return `ocr-${raw}@folga.local`;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file received." },
                { status: 400 }
            );
        }

        const maxSize = 15 * 1024 * 1024;

        if (file.size > maxSize) {
            return NextResponse.json(
                {
                    success: false,
                    error: "File too large. Maximum allowed size is 15 MB.",
                },
                { status: 413 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || "candidates";
        const supabase = getSupabaseAdmin();

        const safeName = file.name.replace(/[^\w.\-]/g, "_");
        const storagePath = `ocr/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
            });

        if (uploadError) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Storage upload failed: ${uploadError.message}`,
                },
                { status: 500 }
            );
        }

        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storagePath);

        let extractedText = "";

        if (
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf")
        ) {
            extractedText = await extractTextFromPdf(buffer);
        }

        if (extractedText.trim().length < 20) {
            extractedText = await extractTextWithTesseract(buffer);
        }

        const parsedMrz = parsePassportMrz(extractedText);

        if (!parsedMrz) {
            await prisma.auditLog.create({
                data: {
                    action: "OCR_DOCUMENT_UPLOADED_NO_MRZ",
                    entity: "Document",
                    entityId: "OCR_PENDING",
                    details: {
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type,
                        storagePath,
                    },
                },
            });

            return NextResponse.json(
                {
                    success: false,
                    status: "OCR_REVIEW_REQUIRED",
                    error:
                        "Document uploaded, but OCR could not extract a reliable MRZ. Manual review is required.",
                    file: {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        url: publicUrlData.publicUrl,
                        storagePath,
                    },
                    extractedTextPreview: extractedText.slice(0, 1000),
                },
                { status: 422 }
            );
        }

        const duplicate = await prisma.document.findFirst({
            where: {
                documentNumber: parsedMrz.documentNumber || undefined,
            },
            include: {
                candidate: true,
            },
        });

        if (duplicate) {
            return NextResponse.json(
                {
                    success: false,
                    status: "DUPLICATE_DOCUMENT",
                    error: `This document already exists for candidate: ${duplicate.candidate.firstName} ${duplicate.candidate.lastName}`,
                    candidateId: duplicate.candidateId,
                    documentId: duplicate.id,
                    fileUrl: duplicate.fileUrl,
                },
                { status: 409 }
            );
        }

        const candidate = await prisma.candidate.create({
            data: {
                firstName: parsedMrz.firstName || "UNKNOWN",
                lastName: parsedMrz.lastName || "UNKNOWN",
                email: buildCandidateEmail(parsedMrz),
                phone: `DOC-${parsedMrz.documentNumber || crypto.randomUUID()}`,
                dateOfBirth: parsedMrz.dateOfBirth
                    ? new Date(parsedMrz.dateOfBirth)
                    : null,
                citizenship: parsedMrz.issuingCountry || null,
                nationality: parsedMrz.nationality || null,
                sex: parsedMrz.sex || null,
                status: "NEW",
                observations:
                    "Candidate created from identity document OCR. Please review extracted fields before operational use.",
                documents: {
                    create: {
                        type: parsedMrz.documentType || "IDENTITY_DOCUMENT",
                        fileName: file.name,
                        fileUrl: publicUrlData.publicUrl,
                        fileSize: file.size,
                        mimeType: file.type || "application/octet-stream",
                        status: "ACTIVE",
                        documentNumber: parsedMrz.documentNumber || null,
                        issuingCountry: parsedMrz.issuingCountry || null,
                        dateOfExpiry: parsedMrz.dateOfExpiry
                            ? new Date(parsedMrz.dateOfExpiry)
                            : null,
                        dateOfIssue: null,
                        mrzRaw: parsedMrz.mrzRaw || null,
                        ocrText: extractedText,
                        extractedJson: parsedMrz,
                        extractionStatus: "EXTRACTED",
                        confidence: 0.85,
                    },
                },
                history: {
                    create: {
                        fromStatus: "NEW",
                        toStatus: "NEW",
                        changedBy: "SYSTEM_OCR",
                    },
                },
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "OCR_CREATE_CANDIDATE",
                entity: "Candidate",
                entityId: candidate.id,
                details: {
                    fileName: file.name,
                    documentNumber: parsedMrz.documentNumber,
                    issuingCountry: parsedMrz.issuingCountry,
                },
            },
        });

        return NextResponse.json({
            success: true,
            candidateId: candidate.id,
            message: `Candidate created: ${candidate.firstName} ${candidate.lastName}`,
            candidate: {
                id: candidate.id,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
            },
            document: {
                url: publicUrlData.publicUrl,
                documentNumber: parsedMrz.documentNumber,
                mrzRaw: parsedMrz.mrzRaw,
            },
        });
    } catch (error) {
        console.error("OCR identity route error:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : "Unexpected OCR server error.",
            },
            { status: 500 }
        );
    }
}