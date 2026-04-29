export type ParsedMrz = {
    documentType: string;
    issuingCountry?: string;
    documentNumber?: string;
    nationality?: string;
    dateOfBirth?: string;
    sex?: string;
    dateOfExpiry?: string;
    lastName?: string;
    firstName?: string;
    identityNumber?: string;
    mrzRaw?: string;
    confidence: number;
    source: "MRZ";
};

function cleanMrzText(text: string) {
    return text
        .toUpperCase()
        .replace(/[ \t]/g, "")
        .replace(/[«‹]/g, "<")
        .replace(/[^A-Z0-9<\n]/g, "\n")
        .split(/\r?\n/)
        .map((line) =>
            line
                .replace(/[^A-Z0-9<]/g, "")
                .replace(/^P<C0L/, "P<COL")
                .replace(/C0L/g, "COL")
                .trim()
        )
        .filter(Boolean);
}

function parseYYMMDD(value: string): string | undefined {
    const safe = value.replace(/[OQ]/g, "0").replace(/[IL]/g, "1");

    if (!/^\d{6}$/.test(safe)) return undefined;

    const yy = Number(safe.slice(0, 2));
    const mm = Number(safe.slice(2, 4));
    const dd = Number(safe.slice(4, 6));

    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;

    const currentYY = new Date().getFullYear() % 100;
    const century = yy > currentYY ? 1900 : 2000;

    return `${century + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
        2,
        "0"
    )}`;
}

function normalizeName(value: string) {
    return value.replace(/</g, " ").replace(/\s+/g, " ").trim();
}

function findPassportLines(text: string) {
    const lines = cleanMrzText(text);

    for (let i = 0; i < lines.length; i++) {
        const first = lines[i];
        const second = lines[i + 1] || "";

        if ((first.startsWith("P<COL") || first.startsWith("P<")) && second.length >= 25) {
            return { first, second };
        }
    }

    const joined = lines.join("");

    const pIndex = joined.indexOf("P<");
    if (pIndex >= 0) {
        const candidate = joined.slice(pIndex);
        const first = candidate.slice(0, 44);
        const second = candidate.slice(44, 88);

        if (first.startsWith("P<") && second.length >= 25) {
            return { first, second };
        }
    }

    return null;
}

export function parsePassportMrz(text: string): ParsedMrz | null {
    const lines = findPassportLines(text);

    if (!lines) return null;

    const firstLine = lines.first.padEnd(44, "<").slice(0, 44);
    const secondLine = lines.second.padEnd(44, "<").slice(0, 44);

    const issuingCountry = firstLine.slice(2, 5).replace(/[0]/g, "O").replace(/</g, "");
    const namePart = firstLine.slice(5);
    const [rawSurname, rawGivenNames] = namePart.split("<<");

    const lastName = normalizeName(rawSurname || "");
    const firstName = normalizeName(rawGivenNames || "");

    const documentNumber = secondLine
        .slice(0, 9)
        .replace(/</g, "")
        .replace(/[OQ]/g, "0");

    const nationality = secondLine
        .slice(10, 13)
        .replace(/[0]/g, "O")
        .replace(/</g, "");

    const dateOfBirth = parseYYMMDD(secondLine.slice(13, 19));
    const sex = secondLine.slice(20, 21).replace(/</g, "");
    const dateOfExpiry = parseYYMMDD(secondLine.slice(21, 27));

    let confidence = 0;

    if (firstName) confidence += 0.22;
    if (lastName) confidence += 0.22;
    if (documentNumber && documentNumber.length >= 5) confidence += 0.22;
    if (dateOfBirth) confidence += 0.14;
    if (dateOfExpiry) confidence += 0.1;
    if (issuingCountry) confidence += 0.05;
    if (nationality) confidence += 0.05;

    if (!firstName && !lastName && !documentNumber) return null;

    return {
        documentType: "PASSPORT",
        issuingCountry,
        documentNumber,
        nationality,
        dateOfBirth,
        sex,
        dateOfExpiry,
        lastName,
        firstName,
        mrzRaw: `${firstLine}\n${secondLine}`,
        confidence: Math.min(confidence, 0.96),
        source: "MRZ",
    };
}