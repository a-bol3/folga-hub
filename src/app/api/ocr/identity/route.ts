// src/app/api/ocr/identity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { parsePassportMrz } from "@/lib/ocr/mrz";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, loadImage } from "canvas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disable worker in Node environment
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = "";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase credentials.");
    }

    return createClient(url, key);
}

/**
 * Recorta una franja inferior de la imagen (por defecto 25 % de la altura),
 * donde normalmente se encuentra la MRZ de los pasaportes.
 */
function cropBottomBand(
    sourceCanvas: ReturnType<typeof createCanvas>,
    ratio: number = 0.25
) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    const bandHeight = Math.max(Math.round(height * ratio), 40); // al menos 40px
    const startY = height - bandHeight;

    const cropped = createCanvas(width, bandHeight);
    const ctx = cropped.getContext("2d");

    ctx.drawImage(
        sourceCanvas,
        0,
        startY,
        width,
        bandHeight,
        0,
        0,
        width,
        bandHeight
    );

    return cropped;
}

/**
 * Extrae texto de un PDF:
 * - intenta texto embebido;
 * - si no hay MRZ ahí, renderiza páginas como imagen,
 *   recorta franja inferior y aplica Tesseract.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
        const uint8Array = new Uint8Array(buffer);
        const loadingTask = (pdfjsLib as any).getDocument({
            data: uint8Array,
            verbosity: 0,
        });
        const pdf = await loadingTask.promise;

        const numPages = Math.min(pdf.numPages, 3);
        const allTexts: string[] = [];

        const Tesseract = await import("tesseract.js");

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);

            // 1) rápido: texto embebido
            const textContent = await page.getTextContent();
            const embeddedText = textContent.items
                .map((item: any) => ("str" in item ? item.str : ""))
                .join(" ")
                .trim();

            if (embeddedText.length > 20) {
                allTexts.push(embeddedText);
            }

            // 2) OCR sobre franja MRZ
            const viewport = page.getViewport({ scale: 2.5 });
            const fullCanvas = createCanvas(
                Math.round(viewport.width),
                Math.round(viewport.height)
            );
            const ctx = fullCanvas.getContext("2d");

            await page
                .render({
                    canvasContext: ctx as any,
                    viewport,
                })
                .promise;

            const mrzCanvas = cropBottomBand(fullCanvas, 0.25);
            const imageBuffer = mrzCanvas.toBuffer("image/png");

            const result = await Tesseract.recognize(imageBuffer, "eng+spa", {
                logger: () => { },
            });

            if (result.data.text) {
                allTexts.push(result.data.text);
            }
        }

        return allTexts.join("\n");
    } catch (error) {
        console.error("PDF render + OCR failed:", error);
        return "";
    }
}

/**
 * Extrae texto de una imagen (JPG/PNG):
 * - carga la imagen en canvas;
 * - recorta franja inferior;
 * - aplica Tesseract sobre esa franja.
 */
async function extractTextFromImage(buffer: Buffer): Promise<string> {
    try {
        const img = await loadImage(buffer);
        const fullCanvas = createCanvas(img.width, img.height);
        const ctx = fullCanvas.getContext("2d");

        // Dibujar imagen original
        ctx.drawImage(img, 0, 0);

        // Recortar franja MRZ
        const mrzCanvas = cropBottomBand(fullCanvas, 0.25);
        const imageBuffer = mrzCanvas.toBuffer("image/png");

        const Tesseract = await import("tesseract.js");
        const result = await Tesseract.recognize(imageBuffer, "eng+spa", {
            logger: () => { },
        });

        return result.data.text || "";
    } catch (error) {
        console.error("Tesseract OCR on image failed:", error);
        return "";
    }
}

/**
 * Email interno placeholder para candidatos creados por OCR.
 */
function buildCandidateEmail(parsed: {
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
}): string {
    const parts = [
        (parsed.firstName || "unknown").toLowerCase(),
        (parsed.lastName || "candidate").toLowerCase(),
        parsed.documentNumber || crypto.randomUUID().slice(0, 8),
    ]
        .join("-")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "");

    return `ocr-${parts}@folga.local`;
}

/**
 * Teléfono interno placeholder basado en el número de documento.
 */
function buildCandidatePhone(documentNumber?: string): string {
    return `DOC-${documentNumber || crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");
        const isImage =
            file.type.startsWith("image/") ||
            /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(file.name);

        if (!isPdf && !isImage) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Unsupported file type. Please upload a PDF, JPG or PNG identity document.",
                },
                { status: 415 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || "candidates";
        const supabase = getSupabaseAdmin();

        const safeName = file.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w.\-]/g, "_");
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

        // ===== OCR =====
        let extractedText = "";
        if (isPdf) {
            extractedText = await extractTextFromPdf(buffer);
        } else {
            extractedText = await extractTextFromImage(buffer);
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
                        extractedTextLength: extractedText.length,
                        extractedTextPreview: extractedText.slice(0, 500),
                    },
                },
            });

            return NextResponse.json(
                {
                    success: false,
                    status: "OCR_REVIEW_REQUIRED",
                    error:
                        "Document uploaded successfully, but OCR could not extract reliable MRZ data. Manual review is ready.",
                    file: {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        url: publicUrlData.publicUrl,
                        storagePath,
                    },
                    debug: {
                        extractedTextLength: extractedText.length,
                        extractedTextPreview: extractedText.slice(0, 300),
                    },
                },
                { status: 422 }
            );
        }

        // ===== DUPLICATES =====
        if (parsedMrz.documentNumber) {
            const duplicate = await prisma.document.findFirst({
                where: { documentNumber: parsedMrz.documentNumber },
                include: { candidate: true },
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
        }

        // ===== CREATE CANDIDATE =====
        const candidate = await prisma.candidate.create({
            data: {
                firstName: parsedMrz.firstName || "UNKNOWN",
                lastName: parsedMrz.lastName || "UNKNOWN",
                email: buildCandidateEmail(parsedMrz),
                phone: buildCandidatePhone(parsedMrz.documentNumber),
                dateOfBirth: parsedMrz.dateOfBirth
                    ? new Date(parsedMrz.dateOfBirth)
                    : null,
                citizenship: parsedMrz.issuingCountry || null,
                nationality: parsedMrz.nationality || null,
                sex: parsedMrz.sex || null,
                status: "NEW",
                observations:
                    "⚠️ Candidate created from identity document OCR. Email and phone are system placeholders and must be updated with real contact data before operational use.",
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
                        ocrText: extractedText.slice(0, 5000),
                        extractedJson: parsedMrz as any,
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
                    parsedName: `${parsedMrz.firstName} ${parsedMrz.lastName}`,
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
                email: candidate.email,
                phone: candidate.phone,
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
                    error instanceof Error
                        ? error.message
                        : "Unexpected OCR server error.",
            },
            { status: 500 }
        );
    }
}