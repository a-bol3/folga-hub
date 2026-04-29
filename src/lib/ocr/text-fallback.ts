import { normalizeIdentity, type NormalizedIdentity } from "@/lib/ocr/normalize-identity";

const MONTHS: Record<string, string> = {
    JAN: "01",
    ENE: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    ABR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    AGO: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
    DIC: "12",
};

function cleanText(text: string) {
    return text
        .toUpperCase()
        .replace(/[^\p{L}\p{N}<\s/.-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parsePassportDate(text: string): string | undefined {
    const match = text.match(/(\d{2})\s+([A-Z]{3})(?:\/[A-Z]{3})?\s+(\d{4})/);

    if (!match) return undefined;

    const day = match[1];
    const month = MONTHS[match[2]];
    const year = match[3];

    if (!month) return undefined;

    return `${year}-${month}-${day}`;
}

function extractAfterLabel(text: string, label: string, stopLabels: string[]) {
    const start = text.indexOf(label);
    if (start < 0) return undefined;

    const after = text.slice(start + label.length).trim();

    let end = after.length;

    for (const stop of stopLabels) {
        const idx = after.indexOf(stop);
        if (idx >= 0 && idx < end) end = idx;
    }

    const value = after.slice(0, end).trim();

    return value || undefined;
}

export function parseColombianPassportText(text: string): Partial<NormalizedIdentity> | null {
    const clean = cleanText(text);

    const documentNumber =
        clean.match(/\bB[A-Z0-9]\d{5,7}\b/)?.[0] ||
        clean.match(/\bBD\d{6,8}\b/)?.[0] ||
        clean.match(/\bBF\d{6,8}\b/)?.[0];

    const identityNumber = clean.match(/\bCC\d{7,12}\b/)?.[0];

    const dateOfBirthMatch =
        clean.match(/\d{2}\s+(?:ENE|JAN|FEB|MAR|ABR|APR|MAY|JUN|JUL|AGO|AUG|SEP|OCT|NOV|DIC|DEC)(?:\/[A-Z]{3})?\s+\d{4}/)?.[0];

    const dateOfBirth = dateOfBirthMatch
        ? parsePassportDate(dateOfBirthMatch)
        : undefined;

    let lastName = extractAfterLabel(clean, "APELLIDOS SURNAME", [
        "NOMBRES",
        "GIVEN",
        "NACIONALIDAD",
    ]);

    let firstName = extractAfterLabel(clean, "NOMBRES GIVEN NAMES", [
        "NACIONALIDAD",
        "FECHA",
        "DATE",
    ]);

    if (!lastName) {
        const match = clean.match(/P<COL([A-Z<]+)<<([A-Z<]+)/);
        if (match) {
            lastName = match[1].replace(/</g, " ").trim();
            firstName = match[2].replace(/</g, " ").trim();
        }
    }

    if (!firstName || !lastName || !documentNumber) {
        return null;
    }

    const sex = clean.includes(" SEXO SEX F ") || clean.includes(" SEX F ")
        ? "F"
        : clean.includes(" SEXO SEX M ") || clean.includes(" SEX M ")
            ? "M"
            : undefined;

    const placeOfBirth =
        clean.match(/\b(BOGOTA|BARRANQUILLA|CAJICA|CALI|MEDELLIN|CARTAGENA)\s+COL\b/)?.[0];

    return normalizeIdentity({
        documentType: "PASSPORT",
        firstName,
        lastName,
        documentNumber,
        identityNumber,
        issuingCountry: "COL",
        nationality: "COL",
        sex,
        dateOfBirth,
        placeOfBirth,
        confidence: 0.9,
        source: "TEXT_FALLBACK",
    });
}