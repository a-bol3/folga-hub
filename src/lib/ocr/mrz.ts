// src/lib/ocr/mrz.ts
// Robust MRZ parser for ICAO 9303 Type P (Passport) documents (with fallback)

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

function cleanMrzLine(line: string): string {
    return line
        .toUpperCase()
        .replace(/\s+/g, "") // remove spaces
        .replace(/[^A-Z0-9<]/g, "") // keep only valid MRZ chars
        .trim();
}

function findMrzLinesStrict(text: string): { line1: string; line2: string } | null {
    const allLines = text
        .split(/\r?\n/)
        .map(cleanMrzLine)
        .filter((line) => line.length >= 30);

    // Normal case: line1 starts with P<
    let line1Idx = allLines.findIndex(
        (line) => /^P[<A-Z]/.test(line) || line.startsWith("P<")
    );
    if (line1Idx !== -1 && allLines[line1Idx + 1]?.length >= 30) {
        return { line1: allLines[line1Idx], line2: allLines[line1Idx + 1] };
    }

    // Fallback strict: detect typical passport second line pattern
    const secondLinePattern =
        /[A-Z0-9<]{9}[0-9][A-Z<]{3}[0-9]{6}[0-9][MF<][0-9]{6}[0-9]/;

    for (let i = 0; i < allLines.length; i++) {
        if (secondLinePattern.test(allLines[i]) && i > 0) {
            const candidate1 = allLines[i - 1];
            if (
                candidate1.includes("<<") ||
                candidate1.includes("P<") ||
                candidate1.startsWith("P")
            ) {
                return { line1: candidate1, line2: allLines[i] };
            }
        }
    }

    return null;
}

/**
 * Fallback para casos en los que solo se ve la línea de nombres (ej. "<<MARTHA<YURANY")
 * y la segunda línea MRZ con números, pero se ha perdido el prefijo "P<COLAPELLIDOS<...".
 */
function findMrzLinesFallback(text: string): { line1: string; line2: string } | null {
    const allLines = text
        .split(/\r?\n/)
        .map(cleanMrzLine)
        .filter((line) => line.length >= 10); // aquí permitimos líneas más cortas

    const secondLinePattern =
        /^[A-Z0-9<]{2,}[0-9][A-Z<]{2,}[0-9]{6}[0-9][MF<][0-9]{6}[0-9]/;

    let secondLineIndex = -1;
    for (let i = 0; i < allLines.length; i++) {
        if (secondLinePattern.test(allLines[i])) {
            secondLineIndex = i;
            break;
        }
    }
    if (secondLineIndex === -1) return null;

    // Buscar una línea de nombres justo encima o cerca, que contenga "<<"
    let nameLineIndex = -1;
    for (let i = secondLineIndex - 1; i >= 0; i--) {
        if (allLines[i].includes("<<")) {
            nameLineIndex = i;
            break;
        }
    }
    if (nameLineIndex === -1) return null;

    const rawNameLine = allLines[nameLineIndex];

    // Fallback: construimos una pseudo primera línea MRZ
    // Suponemos pasaporte (P), país desconocido, apellidos desconocidos + names de la línea encontrada.
    const pseudoFirstLine =
        "P<" +
        "XXX" + // issuing country unknown
        rawNameLine.padEnd(39, "<").slice(0, 39);

    return {
        line1: pseudoFirstLine,
        line2: allLines[secondLineIndex],
    };
}

function parseYYMMDD(value: string): string | undefined {
    if (!/^\d{6}$/.test(value)) return undefined;

    const yy = Number(value.slice(0, 2));
    const mm = value.slice(2, 4);
    const dd = value.slice(4, 6);

    const currentYY = new Date().getFullYear() % 100;
    const century = yy > currentYY ? 1900 : 2000;

    const year = century + yy;
    const month = Number(mm);
    const day = Number(dd);

    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

    return `${year}-${mm}-${dd}`;
}

function parseSex(raw: string): string {
    if (raw === "M") return "M";
    if (raw === "F") return "F";
    return "UNSPECIFIED";
}

function isGarbageName(lastName: string, firstName: string): boolean {
    const full = `${lastName} ${firstName}`.toUpperCase();

    if (full.length > 60) return true;

    const noisyTokens = [
        "APELLIDOS",
        "NOMBRES",
        "NACIONALIDAD",
        "NATIONALITY",
        "FECHA",
        "NACIMIENTO",
        "DATEOFBIRTH",
        "LUGARDENACIMIENTO",
        "PLACEOFBIRTH",
        "SEXO",
        "SEX",
        "FECHADEEXPEDICION",
        "FECHADEVENCIMIENTO",
        "DATEOFISSUE",
        "DATEOFEXPIRY",
        "NUMPERSONAL",
        "PERSONALNO",
    ];

    if (noisyTokens.some((token) => full.includes(token))) {
        return true;
    }

    const words = full.split(/\s+/).filter(Boolean);
    if (words.length > 6) return true;

    return false;
}

export function parsePassportMrz(text: string): ParsedMrz | null {
    if (!text || text.trim().length < 10) return null;

    // 1) Intento estricto normal
    let found = findMrzLinesStrict(text);

    // 2) Fallback si no encontramos línea que empiece por P<
    if (!found) {
        found = findMrzLinesFallback(text);
    }

    if (!found) return null;

    const { line1, line2 } = found;

    if (line2.length < 30) return null;

    const issuingCountry = line1.slice(2, 5).replace(/</g, "").trim();
    const namePart = line1.slice(5).padEnd(39, "<");

    const doubleChevronIdx = namePart.indexOf("<<");
    let lastName: string;
    let firstName: string;

    if (doubleChevronIdx !== -1) {
        lastName = namePart
            .slice(0, doubleChevronIdx)
            .replace(/</g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
        firstName = namePart
            .slice(doubleChevronIdx + 2)
            .replace(/</g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
    } else {
        lastName = namePart.replace(/</g, " ").replace(/\s{2,}/g, " ").trim();
        firstName = "";
    }

    const documentNumber = line2.slice(0, 9).replace(/</g, "").trim();
    const nationality = line2.slice(10, 13).replace(/</g, "").trim();
    const rawDOB = line2.slice(13, 19);
    const rawSex = line2.slice(20, 21);
    const rawExpiry = line2.slice(21, 27);

    const dateOfBirth = parseYYMMDD(rawDOB);
    const dateOfExpiry = parseYYMMDD(rawExpiry);
    const sex = parseSex(rawSex);

    const docLooksLikePassport =
        /^[A-Z][0-9]{6,8}$/.test(documentNumber) || /^[A-Z0-9]{8,9}$/.test(documentNumber);

    if (!documentNumber || !docLooksLikePassport) {
        return null;
    }

    // Si el nombre es claramente basura, pero venimos del fallback, podemos permitir UNKNOWN lastName
    const garbage = isGarbageName(lastName, firstName);
    if (garbage && !found) {
        return null;
    }

    // En el caso fallback (Martha) el lastName puede quedar vacío; lo marcamos como UNKNOWN
    if (!lastName && firstName) {
        lastName = "UNKNOWN";
    }

    return {
        documentType: "PASSPORT",
        issuingCountry: issuingCountry || undefined,
        documentNumber,
        nationality: nationality || undefined,
        dateOfBirth,
        sex,
        dateOfExpiry,
        lastName: lastName || undefined,
        firstName: firstName || undefined,
        mrzRaw: `${line1}\n${line2}`,
    };
}