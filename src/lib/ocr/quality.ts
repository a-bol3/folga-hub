export type OcrDecision = "AUTO_CREATE" | "REVIEW_REQUIRED" | "REJECT";

export type IdentityExtractionInput = {
    firstName?: string | null;
    lastName?: string | null;
    documentNumber?: string | null;
    dateOfBirth?: string | null;
    mrzRaw?: string | null;
    confidence?: number | null;
};

export function evaluateIdentityExtraction(input: IdentityExtractionInput): {
    decision: OcrDecision;
    reasons: string[];
    confidence: number;
} {
    const reasons: string[] = [];

    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    const documentNumber = input.documentNumber?.trim();
    const dateOfBirth = input.dateOfBirth?.trim();
    const mrzRaw = input.mrzRaw?.trim();
    const confidence = input.confidence ?? 0;

    if (!firstName || firstName.length < 2) {
        reasons.push("Missing or weak first name.");
    }

    if (!lastName || lastName.length < 2) {
        reasons.push("Missing or weak last name.");
    }

    if (!documentNumber || documentNumber.length < 5) {
        reasons.push("Missing or weak document number.");
    }

    if (!dateOfBirth && !mrzRaw) {
        reasons.push("Missing date of birth and MRZ.");
    }

    if (confidence < 0.85) {
        reasons.push(`Low confidence: ${confidence.toFixed(2)}.`);
    }

    const strongEnough =
        Boolean(firstName) &&
        Boolean(lastName) &&
        Boolean(documentNumber) &&
        documentNumber!.length >= 5 &&
        Boolean(dateOfBirth || mrzRaw) &&
        confidence >= 0.85;

    const hasSomeUsefulData =
        Boolean(firstName) ||
        Boolean(lastName) ||
        Boolean(documentNumber) ||
        Boolean(mrzRaw);

    if (strongEnough) {
        return {
            decision: "AUTO_CREATE",
            reasons: [],
            confidence,
        };
    }

    if (hasSomeUsefulData) {
        return {
            decision: "REVIEW_REQUIRED",
            reasons,
            confidence,
        };
    }

    return {
        decision: "REJECT",
        reasons: ["No reliable identity data extracted."],
        confidence,
    };
}