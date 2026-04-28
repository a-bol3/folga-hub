// src/app/api/ocr/identity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";
import { parsePassportMrz } from "@/lib/ocr/mrz";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, loadImage } from "canvas";
import {
    DocumentAnalysisClient,
    AzureKeyCredential,
    AnalyzeResult,
    DocumentField,
    AnalyzedDocument,
} from "@azure/ai-form-recognizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disable worker in Node environment
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = "";

// ---------- SUPABASE ADMIN CLIENT ----------

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase credentials.");
    }

    return createClient(url, key);
}

// ---------- AZURE DOCUMENT INTELLIGENCE CLIENT ----------

function getAzureClient() {
    const endpoint = process.env.AZURE_DI_ENDPOINT;
    const key = process.env.AZURE_DI_KEY;

    if (!endpoint || !key) {
        throw new Error("Missing Azure Document Intelligence credentials.");
    }

    return new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
}

// ---------- HELPERS CANVAS / TESSERACT ----------

function cropBottomBand(
    sourceCanvas: ReturnType<typeof createCanvas>,
    ratio: number = 0.25
) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    const bandHeight = Math.max(Math.round(height * ratio), 40);
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

            const textContent = await page.getTextContent();
            const embeddedText = textContent.items
                .map((item: any) => ("str" in item ? item.str : ""))
                .join(" ")
                .trim();

            if (embeddedText.length > 20) {
                allTexts.push(embeddedText);
            }

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

            const mrzCanvas = cropBottomBand(fullCanvas, 0.35);
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

async function extractTextFromImage(buffer: Buffer): Promise<string> {
    try {
        const img = await loadImage(buffer);
        const Tesseract = await import("tesseract.js");

        const fullCanvas = createCanvas(img.width, img.height);
        const ctx = fullCanvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const fullBuffer = fullCanvas.toBuffer("image/png");

        const fullResult = await Tesseract.recognize(fullBuffer, "eng", {
            logger: () => { },
        });

        const mrzCanvas = cropBottomBand(fullCanvas, 0.35);
        const mrzBuffer = mrzCanvas.toBuffer("image/png");

        const mrzResult = await Tesseract.recognize(mrzBuffer, "eng", {
            logger: () => { },
        });

        return `${fullResult.data.text || ""}\n${mrzResult.data.text || ""}`;
    } catch (error) {
        console.error("Tesseract OCR on image failed:", error);
        return "";
    }
}

// Reescalar imagen grande antes de enviarla a Azure
async function resizeImageForAzure(original: Buffer): Promise<Buffer> {
    try {
        const img = await loadImage(original);
        const maxDim = 2000; // px

        const scale = Math.min(
            maxDim / img.width,
            maxDim / img.height,
            1 // nunca escalar hacia arriba
        );

        if (scale === 1) {
            return original;
        }

        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG calidad media para reducir tamaño
        return canvas.toBuffer("image/jpeg", { quality: 0.7 });
    } catch (error) {
        console.error("resizeImageForAzure failed, fallback to original buffer:", error);
        return original;
    }
}

// ---------- HELPERS CANDIDATE PLACEHOLDERS ----------

function buildCandidateEmail(parsed: {
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
}): string | null {
    return null;
}

function buildCandidatePhone(documentNumber?: string): string | null {
    return null;
}

// ---------- AZURE MAPPING HELPERS ----------

type ParsedIdentity = {
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
    dateOfBirth?: string;
    dateOfExpiry?: string;
    issuingCountry?: string;
    nationality?: string;
    sex?: string;
    mrzRaw?: string;
    documentType?: string;
};

function getFieldValueString(field: DocumentField | undefined): string | undefined {
    if (!field) return undefined;
    if (field.kind === "string") return field.value;
    if (field.kind === "countryRegion") return field.value;
    if (field.kind === "selectionMark") return field.value;
    return undefined;
}

function getFieldValueDate(field: DocumentField | undefined): string | undefined {
    if (!field) return undefined;
    if (field.kind === "date") {
        return new Date(field.value).toISOString();
    }
    return undefined;
}

async function tryAzureIdDocument(
    originalBuffer: Buffer,
    mimeType: string
): Promise<ParsedIdentity | null> {
    try {
        const client = getAzureClient();

        // Si es imagen grande, la reducimos antes de enviar a Azure
        let azureBuffer = originalBuffer;
        if (mimeType.startsWith("image/") && originalBuffer.byteLength > 3 * 1024 * 1024) {
            azureBuffer = await resizeImageForAzure(originalBuffer);
        }

        const poller = await client.beginAnalyzeDocument(
            "prebuilt-idDocument",
            azureBuffer,
            {
                onProgress: () => { },
            }
        );

        const result: AnalyzeResult | undefined = await poller.pollUntilDone();

        if (!result || !result.documents || result.documents.length === 0) {
            return null;
        }

        const doc: AnalyzedDocument = result.documents[0];
        const fields = doc.fields ?? {};

        const firstName =
            getFieldValueString(fields["firstName"]) ||
            getFieldValueString(fields["givenName"]);
        const lastName =
            getFieldValueString(fields["lastName"]) ||
            getFieldValueString(fields["surname"]) ||
            getFieldValueString(fields["surnames"]);

        const documentNumber = getFieldValueString(fields["documentNumber"]);
        const dateOfBirth = getFieldValueDate(fields["dateOfBirth"]);
        const dateOfExpiry = getFieldValueDate(fields["dateOfExpiration"]);
        const issuingCountry =
            getFieldValueString(fields["countryRegion"]) ||
            getFieldValueString(fields["issuingCountry"]);
        const nationality = getFieldValueString(fields["nationality"]);
        const sex = getFieldValueString(fields["sex"]);
        const documentType =
            getFieldValueString(fields["documentType"]) ?? "IDENTITY_DOCUMENT";

        const parsed: ParsedIdentity = {
            firstName,
            lastName,
            documentNumber,
            dateOfBirth: dateOfBirth ?? undefined,
            dateOfExpiry: dateOfExpiry ?? undefined,
            issuingCountry: issuingCountry ?? undefined,
            nationality: nationality ?? undefined,
            sex: sex ?? undefined,
            documentType,
        };

        let mrzRaw: string | undefined;
        const anyDoc = doc as any;
        const content: string | undefined =
            typeof anyDoc.content === "string" ? anyDoc.content : undefined;

        if (content) {
            const mrzCandidate = content
                .split("\n")
                .filter((l: string) => l.includes("<<") || l.trim().length > 40)
                .join("\n")
                .trim();
            if (mrzCandidate.length > 0) {
                mrzRaw = mrzCandidate;
            }
        }
        parsed.mrzRaw = mrzRaw;

        const docNumConf = fields["documentNumber"]?.confidence ?? 0;
        const firstConf =
            fields["firstName"]?.confidence ??
            fields["givenName"]?.confidence ??
            0;
        const lastConf =
            fields["lastName"]?.confidence ??
            fields["surname"]?.confidence ??
            fields["surnames"]?.confidence ??
            0;

        const confidence = docNumConf + firstConf + lastConf;

        if (
            (!parsed.firstName || !parsed.lastName) &&
            !parsed.documentNumber &&
            !parsed.dateOfBirth
        ) {
            return null;
        }

        if (confidence < 0.6) {
            return null;
        }

        return parsed;
    } catch (error) {
        console.error("Azure Document Intelligence failed:", error);
        return null;
    }
}

// ---------- MAIN HANDLER ----------

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

        // ===== OCR AZURE (PRIMARIO) =====
        let parsedFromAzure: ParsedIdentity | null = null;
        try {
            parsedFromAzure = await tryAzureIdDocument(buffer, file.type || "");
        } catch (e) {
            console.error("Azure DI unexpected error:", e);
            parsedFromAzure = null;
        }

        // ===== OCR TESSERACT + MRZ =====
        let extractedText = "";
        if (isPdf) {
            extractedText = await extractTextFromPdf(buffer);
        } else {
            extractedText = await extractTextFromImage(buffer);
        }

        const parsedMrz = parsePassportMrz(extractedText);

        const merged: ParsedIdentity = {
            firstName: parsedFromAzure?.firstName || parsedMrz?.firstName,
            lastName: parsedFromAzure?.lastName || parsedMrz?.lastName,
            documentNumber:
                parsedFromAzure?.documentNumber || parsedMrz?.documentNumber,
            dateOfBirth:
                parsedFromAzure?.dateOfBirth || parsedMrz?.dateOfBirth || undefined,
            dateOfExpiry:
                parsedFromAzure?.dateOfExpiry || parsedMrz?.dateOfExpiry || undefined,
            issuingCountry:
                parsedFromAzure?.issuingCountry || parsedMrz?.issuingCountry,
            nationality:
                parsedFromAzure?.nationality || parsedMrz?.nationality || undefined,
            sex: parsedFromAzure?.sex || parsedMrz?.sex,
            mrzRaw: parsedMrz?.mrzRaw || parsedFromAzure?.mrzRaw,
            documentType:
                parsedMrz?.documentType ||
                parsedFromAzure?.documentType ||
                "IDENTITY_DOCUMENT",
        };

        // Evaluación de fiabilidad mínima
        const hasDocNumber =
            !!merged.documentNumber && merged.documentNumber.trim().length >= 5;
        const hasName =
            !!merged.firstName &&
            merged.firstName.trim().length >= 2 &&
            !!merged.lastName &&
            merged.lastName.trim().length >= 2;

        const mrzOnlySafe =
            !parsedFromAzure && parsedMrz && (hasDocNumber || hasName);

        if (!hasDocNumber && !hasName && !mrzOnlySafe) {
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
                        azureUsed: !!parsedFromAzure,
                        parsedMrz,
                        merged,
                    },
                },
            });

            return NextResponse.json(
                {
                    success: false,
                    status: "OCR_REVIEW_REQUIRED",
                    error:
                        "Document uploaded successfully, but OCR could not extract reliable identity data. Manual review is required.",
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
                        parsedMrz,
                        merged,
                    },
                },
                { status: 422 }
            );
        }

        // ===== DUPLICATES =====
        if (merged.documentNumber) {
            const duplicate = await prisma.document.findFirst({
                where: { documentNumber: merged.documentNumber },
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
                firstName: merged.firstName || "UNKNOWN",
                lastName: merged.lastName || "UNKNOWN",
                email: null,
                phone: null,
                dateOfBirth: merged.dateOfBirth ? new Date(merged.dateOfBirth) : null,
                citizenship: merged.issuingCountry || null,
                nationality: merged.nationality || null,
                sex: merged.sex || null,
                status: "NEW",
                observations:
                    "⚠️ Candidate created from identity document OCR. Email and phone are system placeholders and must be updated with real contact data before operational use.",
                documents: {
                    create: {
                        type: merged.documentType || "IDENTITY_DOCUMENT",
                        fileName: file.name,
                        fileUrl: publicUrlData.publicUrl,
                        fileSize: file.size,
                        mimeType: file.type || "application/octet-stream",
                        status: "ACTIVE",
                        documentNumber: merged.documentNumber || null,
                        issuingCountry: merged.issuingCountry || null,
                        dateOfExpiry: merged.dateOfExpiry
                            ? new Date(merged.dateOfExpiry)
                            : null,
                        dateOfIssue: null,
                        mrzRaw: merged.mrzRaw || null,
                        ocrText: extractedText.slice(0, 5000),
                        extractedJson: {
                            azure: parsedFromAzure,
                            mrz: parsedMrz,
                        } as any,
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
                    documentNumber: merged.documentNumber,
                    issuingCountry: merged.issuingCountry,
                    parsedName: `${merged.firstName || ""} ${merged.lastName || ""}`.trim(),
                    azureUsed: !!parsedFromAzure,
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
                documentNumber: merged.documentNumber,
                mrzRaw: merged.mrzRaw,
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