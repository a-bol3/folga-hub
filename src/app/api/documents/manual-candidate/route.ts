import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).replace(/\s+/g, " ").trim();
    return text.length > 0 ? text : null;
}

function cleanUpper(value: unknown): string | null {
    const text = clean(value);
    return text ? text.toUpperCase() : null;
}

function parseDate(value: unknown): Date | null {
    const text = clean(value);
    if (!text) return null;

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const firstName = cleanUpper(body.firstName);
        const lastName = cleanUpper(body.lastName);

        if (!firstName || !lastName) {
            return NextResponse.json(
                { success: false, error: "First name and last name are required." },
                { status: 400 }
            );
        }

        const fileName = clean(body.fileName);
        const fileUrl = clean(body.fileUrl);

        if (!fileName || !fileUrl) {
            return NextResponse.json(
                { success: false, error: "Document file data is missing." },
                { status: 400 }
            );
        }

        const documentNumber = cleanUpper(body.documentNumber);
        const identityNumber = cleanUpper(body.identityNumber);
        const email = clean(body.email)?.toLowerCase() || null;
        const phone = clean(body.phone);

        if (documentNumber) {
            const existingDocument = await prisma.document.findFirst({
                where: { documentNumber },
                include: { candidate: true },
            });

            if (existingDocument) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Document already exists for ${existingDocument.candidate.firstName} ${existingDocument.candidate.lastName}.`,
                        candidateId: existingDocument.candidateId,
                    },
                    { status: 409 }
                );
            }
        }

        if (email || phone) {
            const existingCandidate = await prisma.candidate.findFirst({
                where: {
                    OR: [
                        ...(email ? [{ email }] : []),
                        ...(phone ? [{ phone }] : []),
                    ],
                },
            });

            if (existingCandidate) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Candidate already exists: ${existingCandidate.firstName} ${existingCandidate.lastName}.`,
                        candidateId: existingCandidate.id,
                    },
                    { status: 409 }
                );
            }
        }

        const candidate = await prisma.candidate.create({
            data: {
                firstName,
                middleName: cleanUpper(body.middleName),
                lastName,
                email,
                phone,
                dateOfBirth: parseDate(body.dateOfBirth),
                placeOfBirth: cleanUpper(body.placeOfBirth),
                countryOfBirth: cleanUpper(body.countryOfBirth),
                citizenship: cleanUpper(body.citizenship),
                nationality: cleanUpper(body.nationality),
                sex: cleanUpper(body.sex),
                status: "NEW",
                observations:
                    clean(body.observations) ||
                    "Candidate created from manual review of identity document.",
                documents: {
                    create: {
                        type: cleanUpper(body.documentType) || "IDENTITY_DOCUMENT",
                        fileName,
                        fileUrl,
                        fileSize: Number(body.fileSize || 0),
                        mimeType: clean(body.mimeType) || "application/octet-stream",
                        status: "ACTIVE",
                        documentNumber,
                        identityNumber,
                        issuingCountry: cleanUpper(body.issuingCountry),
                        dateOfIssue: parseDate(body.dateOfIssue),
                        dateOfExpiry: parseDate(body.dateOfExpiry),
                        mrzRaw: clean(body.mrzRaw),
                        ocrText: clean(body.ocrText),
                        extractedJson: body.extractedJson || null,
                        extractionStatus: "MANUAL_REVIEWED",
                        confidence: 1,
                    },
                },
                history: {
                    create: {
                        fromStatus: "NEW",
                        toStatus: "NEW",
                        changedBy: "SYSTEM_MANUAL_REVIEW",
                    },
                },
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "MANUAL_DOCUMENT_REVIEW_CREATE_CANDIDATE",
                entity: "Candidate",
                entityId: candidate.id,
                details: {
                    fileName,
                    documentNumber,
                    identityNumber,
                    source: "manual-review",
                },
            },
        });

        return NextResponse.json({
            success: true,
            candidateId: candidate.id,
            message: `Candidate created: ${candidate.firstName} ${candidate.lastName}`,
        });
    } catch (error) {
        console.error("Manual candidate creation error:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create candidate manually.",
            },
            { status: 500 }
        );
    }
}