import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { parsePassportMrz } from "@/lib/ocr/mrz";
import { evaluateIdentityExtraction } from "@/lib/ocr/quality";
import {
    mergeIdentities,
    normalizeIdentity,
    type NormalizedIdentity,
} from "@/lib/ocr/normalize-identity";
import { extractHrappkaDocumentData } from "@/lib/ocr/hrappka-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AzureField = {
    kind?: string;
    value?: unknown;
    content?: string;
    confidence?: number;
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase credentials.");
    }

    return createClient(url, key);
}

function getAzureCredentials() {
    const endpoint = process.env.AZURE_DI_ENDPOINT;
    const key = process.env.AZURE_DI_KEY;

    if (!endpoint || !key) {
        throw new Error("Missing Azure Document Intelligence credentials.");
    }

    return { endpoint, key };
}

async function uploadToStorage(file: File, buffer: Buffer) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "candidates";
    const supabase = getSupabaseAdmin();

    const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w.\-]/g, "_");

    const storagePath = `ocr/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
        });

    if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    return {
        bucket,
        storagePath,
        publicUrl: data.publicUrl,
    };
}

function isSupportedFile(file: File) {
    const name = file.name.toLowerCase();

    return (
        file.type === "application/pdf" ||
        file.type.startsWith("image/") ||
        /\.(pdf|jpe?g|png|webp|bmp|tiff?)$/i.test(name)
    );
}

function getField(
    fields: Record<string, AzureField> | undefined,
    names: string[]
) {
    if (!fields) return undefined;

    for (const name of names) {
        const exact = fields[name];
        if (exact) return exact;

        const foundKey = Object.keys(fields).find(
            (key) => key.toLowerCase() === name.toLowerCase()
        );

        if (foundKey) return fields[foundKey];
    }

    return undefined;
}

function fieldText(field?: AzureField): string | undefined {
    if (!field) return undefined;

    if (typeof field.value === "string") return field.value;
    if (field.value instanceof Date) return field.value.toISOString().slice(0, 10);
    if (field.value !== undefined && field.value !== null) return String(field.value);
    if (field.content) return field.content;

    return undefined;
}

function fieldDate(field?: AzureField): string | undefined {
    if (!field) return undefined;

    if (field.value instanceof Date) {
        return field.value.toISOString().slice(0, 10);
    }

    if (typeof field.value === "string") {
        const date = new Date(field.value);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }

    if (field.content) {
        const date = new Date(field.content);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }

    return undefined;
}

function avgConfidence(fields: Array<AzureField | undefined>) {
    const values = fields
        .map((field) => field?.confidence)
        .filter((value): value is number => typeof value === "number");

    if (values.length === 0) return 0;

    return values.reduce((sum, item) => sum + item, 0) / values.length;
}

async function analyzeWithAzureModel(buffer: Buffer, modelId: string) {
    const { endpoint, key } = getAzureCredentials();
    const azure = await import("@azure/ai-form-recognizer");

    const client = new azure.DocumentAnalysisClient(
        endpoint,
        new azure.AzureKeyCredential(key)
    );

    const poller = await client.beginAnalyzeDocument(modelId, buffer);
    return poller.pollUntilDone();
}

async function extractWithAzureIdDocument(buffer: Buffer): Promise<{
    identity: Partial<NormalizedIdentity> | null;
    rawText: string;
    raw: Prisma.InputJsonValue;
}> {
    try {
        const result: any = await analyzeWithAzureModel(buffer, "prebuilt-idDocument");

        const doc = result.documents?.[0];
        const fields = doc?.fields as Record<string, AzureField> | undefined;

        const firstNameField = getField(fields, [
            "FirstName",
            "firstName",
            "GivenName",
            "givenName",
            "First Name",
            "Given Names",
        ]);

        const lastNameField = getField(fields, [
            "LastName",
            "lastName",
            "Surname",
            "surname",
            "Last Name",
            "Surnames",
        ]);

        const documentNumberField = getField(fields, [
            "DocumentNumber",
            "documentNumber",
            "PassportNumber",
            "passportNumber",
            "Document Number",
            "Passport No",
        ]);

        const personalNumberField = getField(fields, [
            "PersonalNumber",
            "personalNumber",
            "IdentityNumber",
            "identityNumber",
            "IdNumber",
            "ID Number",
        ]);

        const birthField = getField(fields, [
            "DateOfBirth",
            "dateOfBirth",
            "BirthDate",
            "Date of Birth",
        ]);

        const expiryField = getField(fields, [
            "DateOfExpiration",
            "dateOfExpiration",
            "DateOfExpiry",
            "dateOfExpiry",
            "ExpiryDate",
            "Date of Expiry",
        ]);

        const issueField = getField(fields, [
            "DateOfIssue",
            "dateOfIssue",
            "IssueDate",
            "Date of Issue",
        ]);

        const countryField = getField(fields, [
            "CountryRegion",
            "countryRegion",
            "IssuingCountry",
            "issuingCountry",
            "Country",
        ]);

        const nationalityField = getField(fields, ["Nationality", "nationality"]);
        const sexField = getField(fields, ["Sex", "sex", "Gender", "gender"]);

        const placeOfBirthField = getField(fields, [
            "PlaceOfBirth",
            "placeOfBirth",
            "BirthPlace",
        ]);

        const confidence = avgConfidence([
            firstNameField,
            lastNameField,
            documentNumberField,
            birthField,
            expiryField,
        ]);

        const identity = normalizeIdentity({
            documentType: "IDENTITY_DOCUMENT",
            firstName: fieldText(firstNameField),
            lastName: fieldText(lastNameField),
            documentNumber: fieldText(documentNumberField),
            identityNumber: fieldText(personalNumberField),
            dateOfBirth: fieldDate(birthField),
            dateOfIssue: fieldDate(issueField),
            dateOfExpiry: fieldDate(expiryField),
            issuingCountry: fieldText(countryField),
            nationality: fieldText(nationalityField),
            sex: fieldText(sexField),
            placeOfBirth: fieldText(placeOfBirthField),
            confidence,
            source: "AZURE",
        });

        return {
            identity:
                identity.firstName ||
                    identity.lastName ||
                    identity.documentNumber ||
                    identity.dateOfBirth
                    ? identity
                    : null,
            rawText: result.content || "",
            raw: toPrismaJson({
                fields,
                content: result.content,
            }),
        };
    } catch (error) {
        console.error("Azure prebuilt-idDocument failed:", error);

        return {
            identity: null,
            rawText: "",
            raw: toPrismaJson({
                error: error instanceof Error ? error.message : "Unknown Azure ID error",
            }),
        };
    }
}

async function extractWithAzureRead(buffer: Buffer): Promise<{
    text: string;
    raw: Prisma.InputJsonValue;
}> {
    try {
        const result: any = await analyzeWithAzureModel(buffer, "prebuilt-read");

        return {
            text: result.content || "",
            raw: toPrismaJson({
                content: result.content,
                pages: result.pages,
            }),
        };
    } catch (error) {
        console.error("Azure prebuilt-read failed:", error);

        return {
            text: "",
            raw: toPrismaJson({
                error: error instanceof Error ? error.message : "Unknown Azure Read error",
            }),
        };
    }
}

async function extractWithLocalTesseract(buffer: Buffer) {
    try {
        const Tesseract = await import("tesseract.js");

        const result = await Tesseract.recognize(buffer, "eng+spa+pol", {
            logger: () => { },
        });

        return result.data.text || "";
    } catch (error) {
        console.error("Local Tesseract fallback failed:", error);
        return "";
    }
}

async function createReviewAudit(args: {
    file: File;
    fileUrl: string;
    storagePath: string;
    extractedText: string;
    extractedData: unknown;
    reasons: string[];
    azureIdRaw: Prisma.InputJsonValue;
    azureReadRaw: Prisma.InputJsonValue | null;
}) {
    await prisma.auditLog.create({
        data: {
            action: "OCR_REVIEW_REQUIRED",
            entity: "Document",
            entityId: "OCR_PENDING",
            details: toPrismaJson({
                fileName: args.file.name,
                fileSize: args.file.size,
                mimeType: args.file.type,
                fileUrl: args.fileUrl,
                storagePath: args.storagePath,
                extractedTextPreview: args.extractedText.slice(0, 1500),
                extractedData: args.extractedData,
                reasons: args.reasons,
                azureIdRaw: args.azureIdRaw,
                azureReadRaw: args.azureReadRaw,
            }),
        },
    });
}

function canAutoCreateCandidate(extractedData: ReturnType<typeof extractHrappkaDocumentData>) {
    const hasName = Boolean(extractedData.firstName && extractedData.lastName);
    const hasIdentifier = Boolean(
        extractedData.documentNumber ||
        extractedData.identityNumber ||
        extractedData.pesel ||
        extractedData.permitNumber
    );

    return hasName && hasIdentifier && extractedData.confidence >= 0.85;
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

        if (!isSupportedFile(file)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unsupported file type. Upload PDF, JPG, PNG, WEBP, BMP, TIFF.",
                },
                { status: 415 }
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
        const uploaded = await uploadToStorage(file, buffer);

        const azureId = await extractWithAzureIdDocument(buffer);
        const azureRead = await extractWithAzureRead(buffer);

        const localText =
            azureRead.text.length > 20 ? "" : await extractWithLocalTesseract(buffer);

        const combinedText = [azureId.rawText, azureRead.text, localText]
            .filter(Boolean)
            .join("\n");

        const mrzIdentity = parsePassportMrz(combinedText);

        const mergedIdentity = mergeIdentities(azureId.identity, mrzIdentity);
        const extractedData = extractHrappkaDocumentData(combinedText, mergedIdentity);

        const quality = evaluateIdentityExtraction({
            firstName: extractedData.firstName,
            lastName: extractedData.lastName,
            documentNumber:
                extractedData.documentNumber ||
                extractedData.identityNumber ||
                extractedData.pesel ||
                extractedData.permitNumber,
            dateOfBirth: extractedData.dateOfBirth,
            mrzRaw: extractedData.mrzRaw,
            confidence: extractedData.confidence,
        });

        const dedupeNumber =
            extractedData.documentNumber ||
            extractedData.identityNumber ||
            extractedData.pesel ||
            extractedData.permitNumber;

        if (dedupeNumber) {
            const duplicateDocument = await prisma.document.findFirst({
                where: {
                    OR: [
                        { documentNumber: dedupeNumber },
                        { identityNumber: dedupeNumber },
                    ],
                },
                include: { candidate: true },
            });

            if (duplicateDocument) {
                return NextResponse.json(
                    {
                        success: false,
                        status: "DUPLICATE_DOCUMENT",
                        error: `This document already exists for candidate: ${duplicateDocument.candidate.firstName} ${duplicateDocument.candidate.lastName}`,
                        candidateId: duplicateDocument.candidateId,
                        documentId: duplicateDocument.id,
                        fileUrl: duplicateDocument.fileUrl,
                        extracted: extractedData,
                    },
                    { status: 409 }
                );
            }
        }

        if (!canAutoCreateCandidate(extractedData)) {
            await createReviewAudit({
                file,
                fileUrl: uploaded.publicUrl,
                storagePath: uploaded.storagePath,
                extractedText: combinedText,
                extractedData,
                reasons: quality.reasons,
                azureIdRaw: azureId.raw,
                azureReadRaw: azureRead.raw,
            });

            return NextResponse.json(
                {
                    success: false,
                    status: "OCR_REVIEW_REQUIRED",
                    error:
                        "Document uploaded successfully, but OCR result requires manual review.",
                    reasons: quality.reasons,
                    file: {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        url: uploaded.publicUrl,
                        storagePath: uploaded.storagePath,
                    },
                    extracted: extractedData,
                    extractedTextPreview: combinedText.slice(0, 1500),
                    debug: {
                        azureIdIdentity: azureId.identity,
                        azureIdRaw: azureId.raw,
                        azureReadRaw: azureRead.raw,
                        mrzIdentity,
                        mergedIdentity,
                        extractedData,
                        quality,
                    },
                },
                { status: 422 }
            );
        }

        const candidate = await prisma.candidate.create({
            data: {
                firstName: extractedData.firstName!,
                lastName: extractedData.lastName!,
                email: null,
                phone: null,
                dateOfBirth: extractedData.dateOfBirth
                    ? new Date(extractedData.dateOfBirth)
                    : null,
                placeOfBirth: extractedData.placeOfBirth || null,
                citizenship: extractedData.issuingCountry || null,
                nationality: extractedData.nationality || null,
                sex: extractedData.sex || null,
                status: "NEW",
                observations:
                    "Candidate created from Azure-first HRappka document OCR. Contact data must be completed manually.",
                documents: {
                    create: {
                        type: extractedData.detectedDocumentType || extractedData.documentType,
                        fileName: file.name,
                        fileUrl: uploaded.publicUrl,
                        fileSize: file.size,
                        mimeType: file.type || "application/octet-stream",
                        status: "ACTIVE",
                        documentNumber:
                            extractedData.documentNumber ||
                            extractedData.permitNumber ||
                            extractedData.decisionNumber ||
                            null,
                        identityNumber:
                            extractedData.identityNumber || extractedData.pesel || null,
                        issuingCountry: extractedData.issuingCountry || null,
                        dateOfIssue: extractedData.dateOfIssue
                            ? new Date(extractedData.dateOfIssue)
                            : null,
                        dateOfExpiry:
                            extractedData.dateOfExpiry || extractedData.dateOfPermitExpiry
                                ? new Date(extractedData.dateOfExpiry || extractedData.dateOfPermitExpiry!)
                                : null,
                        mrzRaw: extractedData.mrzRaw || null,
                        ocrText: combinedText.slice(0, 5000),
                        extractedJson: toPrismaJson({
                            extractedData,
                            azureId: azureId.raw,
                            azureRead: azureRead.raw,
                            mrz: mrzIdentity,
                            quality,
                        }),
                        extractionStatus: "EXTRACTED",
                        confidence: extractedData.confidence,
                    },
                },
                history: {
                    create: {
                        fromStatus: "NEW",
                        toStatus: "NEW",
                        changedBy: "SYSTEM_OCR_AZURE",
                    },
                },
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "OCR_CREATE_CANDIDATE_AZURE_FIRST",
                entity: "Candidate",
                entityId: candidate.id,
                details: toPrismaJson({
                    fileName: file.name,
                    fileUrl: uploaded.publicUrl,
                    extractedData,
                    confidence: extractedData.confidence,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            candidateId: candidate.id,
            message: `Candidate created: ${candidate.firstName} ${candidate.lastName}`,
            extracted: extractedData,
            fileUrl: uploaded.publicUrl,
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