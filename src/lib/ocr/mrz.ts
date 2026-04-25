export type ParsedMrz = {
    documentType?: string;
    issuingCountry?: string;
    documentNumber?: string;
    nationality?: string;
    dateOfBirth?: string;
    sex?: string;
    dateOfExpiry?: string;
    lastName?: string;
    firstName?: string;
    mrzRaw?: string;
};

function cleanMrzLine(line: string) {
    return line
        .toUpperCase()
        .replace(/[^A-Z0-9<]/g, "")
        .trim();
}

function parseYYMMDD(value: string): string | undefined {
    if (!/^\d{6}$/.test(value)) return undefined;

    const yy = Number(value.slice(0, 2));
    const mm = value.slice(2, 4);
    const dd = value.slice(4, 6);

    const currentYY = new Date().getFullYear() % 100;
    const century = yy > currentYY ? 1900 : 2000;

    return `${century + yy}-${mm}-${dd}`;
}

export function parsePassportMrz(text: string): ParsedMrz | null {
    const lines = text
        .split(/\r?\n/)
        .map(cleanMrzLine)
        .filter((line) => line.length >= 30);

    const firstLine = lines.find((line) => line.startsWith("P<"));
    if (!firstLine) return null;

    const firstLineIndex = lines.indexOf(firstLine);
    const secondLine = lines[firstLineIndex + 1];

    if (!secondLine || secondLine.length < 30) return null;

    const issuingCountry = firstLine.slice(2, 5).replace(/</g, "");

    const namePart = firstLine.slice(5);
    const [rawLastName, rawGivenNames] = namePart.split("<<");

    const lastName = rawLastName.replace(/</g, " ").replace(/\s+/g, " ").trim();
    const firstName = (rawGivenNames || "")
        .replace(/</g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const documentNumber = secondLine.slice(0, 9).replace(/</g, "");
    const nationality = secondLine.slice(10, 13).replace(/</g, "");
    const dateOfBirth = parseYYMMDD(secondLine.slice(13, 19));
    const sex = secondLine.slice(20, 21).replace(/</g, "");
    const dateOfExpiry = parseYYMMDD(secondLine.slice(21, 27));

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
    };
}