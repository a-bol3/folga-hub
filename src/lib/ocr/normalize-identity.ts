export type NormalizedIdentity = {
    documentType: string;
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
    identityNumber?: string;
    issuingCountry?: string;
    nationality?: string;
    sex?: string;
    dateOfBirth?: string;
    dateOfIssue?: string;
    dateOfExpiry?: string;
    placeOfBirth?: string;
    mrzRaw?: string;
    ocrText?: string;
    confidence: number;
    source: "AZURE" | "MRZ" | "TEXT_FALLBACK" | "MERGED" | "MANUAL";
};

function clean(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;

    const text = String(value)
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}\s<\-./]/gu, "")
        .trim();

    return text.length > 0 ? text : undefined;
}

function upper(value: unknown): string | undefined {
    const text = clean(value);
    return text ? text.toUpperCase() : undefined;
}

export function normalizeIdentity(
    input: Partial<NormalizedIdentity>
): NormalizedIdentity {
    return {
        documentType: upper(input.documentType) || "IDENTITY_DOCUMENT",
        firstName: upper(input.firstName),
        lastName: upper(input.lastName),
        documentNumber: upper(input.documentNumber),
        identityNumber: upper(input.identityNumber),
        issuingCountry: upper(input.issuingCountry),
        nationality: upper(input.nationality),
        sex: upper(input.sex),
        dateOfBirth: clean(input.dateOfBirth),
        dateOfIssue: clean(input.dateOfIssue),
        dateOfExpiry: clean(input.dateOfExpiry),
        placeOfBirth: upper(input.placeOfBirth),
        mrzRaw: input.mrzRaw?.trim(),
        ocrText: input.ocrText?.trim(),
        confidence: input.confidence ?? 0,
        source: input.source || "MERGED",
    };
}

export function mergeIdentities(
    primary?: Partial<NormalizedIdentity> | null,
    secondary?: Partial<NormalizedIdentity> | null,
    tertiary?: Partial<NormalizedIdentity> | null
): NormalizedIdentity {
    return normalizeIdentity({
        documentType:
            primary?.documentType ||
            secondary?.documentType ||
            tertiary?.documentType ||
            "IDENTITY_DOCUMENT",
        firstName: primary?.firstName || secondary?.firstName || tertiary?.firstName,
        lastName: primary?.lastName || secondary?.lastName || tertiary?.lastName,
        documentNumber:
            primary?.documentNumber ||
            secondary?.documentNumber ||
            tertiary?.documentNumber,
        identityNumber:
            primary?.identityNumber ||
            secondary?.identityNumber ||
            tertiary?.identityNumber,
        issuingCountry:
            primary?.issuingCountry ||
            secondary?.issuingCountry ||
            tertiary?.issuingCountry,
        nationality:
            primary?.nationality || secondary?.nationality || tertiary?.nationality,
        sex: primary?.sex || secondary?.sex || tertiary?.sex,
        dateOfBirth:
            primary?.dateOfBirth || secondary?.dateOfBirth || tertiary?.dateOfBirth,
        dateOfIssue:
            primary?.dateOfIssue || secondary?.dateOfIssue || tertiary?.dateOfIssue,
        dateOfExpiry:
            primary?.dateOfExpiry || secondary?.dateOfExpiry || tertiary?.dateOfExpiry,
        placeOfBirth:
            primary?.placeOfBirth || secondary?.placeOfBirth || tertiary?.placeOfBirth,
        mrzRaw: primary?.mrzRaw || secondary?.mrzRaw || tertiary?.mrzRaw,
        ocrText: primary?.ocrText || secondary?.ocrText || tertiary?.ocrText,
        confidence: Math.max(
            primary?.confidence || 0,
            secondary?.confidence || 0,
            tertiary?.confidence || 0
        ),
        source:
            primary && secondary
                ? "MERGED"
                : primary?.source ||
                secondary?.source ||
                tertiary?.source ||
                "MERGED",
    });
}