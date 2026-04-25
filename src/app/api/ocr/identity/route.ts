import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                {
                    success: false,
                    error: "No identity document received.",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                status: "OCR_NOT_READY",
                message:
                    "File received successfully, but local OCR worker is disabled to prevent Next.js server crash. Next step: process OCR through an external worker.",
                file: {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                },
            },
            { status: 422 }
        );
    } catch (error) {
        console.error("Identity OCR route error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Identity OCR request failed.",
            },
            { status: 500 }
        );
    }
}