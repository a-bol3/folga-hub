import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function required(value: unknown) {
    return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!required(body.firstName) || !required(body.lastName)) {
            return NextResponse.json(
                { success: false, error: "First name and last name are required." },
                { status: 400 }
            );
        }

        if (!required(body.fileUrl) || !required(body.fileName)) {
            return NextResponse.json(
                { success: false, error: "Document file data is missing." },
                { status: 400 }
            );
        }

        const documentNumber = body.documentNumber?.trim() || null;

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

        const email =
            body.email?.trim().toLowerCase() ||
            `manual-${crypto.randomUUID()}@folga.local`;

        const phone =
            body.phone?.trim() ||
            (documentNumber ? `DOC-${documentNumber}` : `DOC-${crypto.randomUUID()}`);

        const existingCandidate = await prisma.candidate.findFirst({
            where: {
                OR: [{ email }, { phone }],
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

        const candidate = await prisma.candidate.create({
            data: {
                firstName: body.firstName.trim(),
                middleName: body.middleName?.trim() || null,
                lastName: body.lastName.trim(),
                email,
                phone,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
                placeOfBirth: body.placeOfBirth?.trim() || null,
                citizenship: body.citizenship?.trim() || null,
                nationality: body.nationality?.trim() || null,
                sex: body.sex?.trim() || null,
                status: "NEW",
                observations:
                    body.observations?.trim() ||
                    "Candidate created from manual identity document review.",
                documents: {
                    create: {
                        type: body.documentType || "IDENTITY_DOCUMENT",
                        fileName: body.fileName,
                        fileUrl: body.fileUrl,
                        fileSize: Number(body.fileSize || 0),
                        mimeType: body.mimeType || "application/octet-stream",
                        status: "ACTIVE",
                        documentNumber,
                        identityNumber: body.identityNumber?.trim() || null,
                        issuingCountry: body.issuingCountry?.trim() || null,
                        dateOfIssue: body.dateOfIssue ? new Date(body.dateOfIssue) : null,
                        dateOfExpiry: body.dateOfExpiry ? new Date(body.dateOfExpiry) : null,
                        mrzRaw: body.mrzRaw?.trim() || null,
                        ocrText: body.ocrText?.trim() || null,
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
                    fileName: body.fileName,
                    documentNumber,
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