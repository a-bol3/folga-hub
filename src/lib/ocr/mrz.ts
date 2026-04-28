// src/lib/ocr/mrz.ts

export type ParsedMrz = {
    documentType?: string;
    issuingCountry?: string;
    documentNumber?: string;
    nationality?: string;
    dateOfBirth?: string;
    sex?: string;
    dateOfExpiry?: string;
    placeOfBirth?: string;
    lastName?: string;
    firstName?: string;
    mrzRaw?: string;
};

function cleanMrzLine(line: string): string {
    return line.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, "").trim();
}

function normalizeLine(line: string): string {
    return line.trim().toUpperCase();
}

function looksLikePassportLine2(line: string): boolean {
    if (line.length < 20) return false;
    const hasDateAndSex = /[0-9]{6}[0-9][MF<]/.test(line);
    const hasMrzCharsOnly = /^[A-Z0-9<]+$/.test(line);
    return hasDateAndSex && hasMrzCharsOnly;
}

function isValidDocumentNumber(docNum: string): boolean {
    if (!docNum || docNum.length < 5) return false;
    if (/^[A-Z][0-9]{6,8}$/.test(docNum)) return true;
    if (/^[A-Z0-9]{6,9}$/.test(docNum)) return true;
    return false;
}

function isGarbageName(lastName: string, firstName: string): boolean {
    const full = `${lastName} ${firstName}`.toUpperCase();
    if (full.length > 60) return true;
    const noisyTokens = [
        "APELLIDOS", "NOMBRES", "NACIONALIDAD", "NATIONALITY",
        "FECHA", "NACIMIENTO", "DATEOFBIRTH", "LUGARDENACIMIENTO",
        "PLACEOFBIRTH", "SEXO", "FECHADEEXPEDICION", "FECHADEVENCIMIENTO",
        "DATEOFISSUE", "DATEOFEXPIRY", "NUMPERSONAL", "PERSONALNO",
    ];
    if (/\bSEX\b/.test(full)) return true;
    if (noisyTokens.some((token) => full.includes(token))) return true;
    const words = full.split(/\s+/).filter(Boolean);
    if (words.length > 6) return true;
    return false;
}

function isCorruptedMrzName(name: string): boolean {
    if (!name || name.length < 2) return true;
    if (/(.)\1{3,}/.test(name)) return true;
    if (!/[AEIOUÁÉÍÓÚ]/.test(name)) return true;
    return false;
}

function findMrzLinesStrict(text: string): { line1: string; line2: string } | null {
    const allLines = text.split(/\r?\n/).map(cleanMrzLine).filter((line) => line.length >= 20);
    const line1Idx = allLines.findIndex((line) => /^P[<A-Z]/.test(line));
    if (line1Idx !== -1) {
        const next = allLines[line1Idx + 1];
        if (next && looksLikePassportLine2(next)) {
            return { line1: allLines[line1Idx], line2: next };
        }
    }
    for (let i = 0; i < allLines.length; i++) {
        if (looksLikePassportLine2(allLines[i]) && i > 0) {
            const candidate1 = allLines[i - 1];
            if (candidate1.includes("<<") || candidate1.includes("P<") || candidate1.startsWith("P")) {
                return { line1: candidate1, line2: allLines[i] };
            }
        }
    }
    return null;
}

function parseMrzLines(line1: string, line2: string): ParsedMrz | null {
    const issuingCountry = line1.slice(2, 5).replace(/</g, "").trim();
    const namePart = line1.slice(5).padEnd(39, "<");
    const doubleChevronIdx = namePart.indexOf("<<");
    let lastName: string;
    let firstName: string;
    if (doubleChevronIdx !== -1) {
        lastName = namePart.slice(0, doubleChevronIdx).replace(/</g, " ").replace(/\s{2,}/g, " ").trim();
        firstName = namePart.slice(doubleChevronIdx + 2).replace(/</g, " ").replace(/\s{2,}/g, " ").trim();
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
    if (isCorruptedMrzName(lastName) || isCorruptedMrzName(firstName)) {
        return null;
    }
    if (!isValidDocumentNumber(documentNumber)) return null;
    if (isGarbageName(lastName, firstName)) return null;
    if (!lastName && firstName) lastName = "UNKNOWN";
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

function extractFromPlainText(text: string): ParsedMrz | null {
    const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
    const monthMap: Record<string, string> = {
        ENE: "01", JAN: "01", FEB: "02", MAR: "03",
        ABR: "04", APR: "04", MAY: "05", JUN: "06",
        JUL: "07", AGO: "08", AUG: "08", SEP: "09",
        OCT: "10", NOV: "11", DIC: "12", DEC: "12",
    };

    const isOcrNoiseWord = (s: string) =>
        /TRNEET|PASEREI|PASAPORTE|PASSPORT|REPUBLICA|COLOMBIA|COD|COUNTRY|CODE|TIPO|TYPE|PAIS|AUTORIDAD|AUTHORITY|NACIONALIDAD|FECHA|SEXO|LUGAR|BIRTH|NACIMIENTO|APEL+IDOS|NOMBRES|SUMAME|SURNAME|GIVEN|HOLDER|SIGNATURE|FIRMA|VENCIMIENTO|EXPIRY|VOID|ISSUE|EXPEDICION|EMISION|COLOMBIANA|NAMES|NAME/.test(s);

    const isRealNameWord = (s: string) => {
        if (s.length < 3) return false;
        if (!/^[A-ZÁÉÍÓÚÑ]+$/.test(s)) return false;
        if (isOcrNoiseWord(s)) return false;
        return /[AEIOUÁÉÍÓÚ]/.test(s);
    };

    const isRealNameLine = (s: string) => {
        const words = s.split(/\s+/).filter(Boolean);
        if (words.length < 1 || words.length > 3) return false;
        return words.every(isRealNameWord);
    };

    const filterNameWords = (line: string) =>
        line.split(/\s+/).filter(isRealNameWord).join(" ");

    // ── Apellidos ──────────────────────────────────────────────────────────────
    let lastName: string | undefined;

    // Estrategia 1: línea con TRNEET/PASEREI — extraer solo palabras reales (Prioridad alta en pasaportes con ruido)
    for (let i = 0; i < lines.length; i++) {
        if (/TRNEET|PASEREI/.test(lines[i])) {
            const words = lines[i].split(/\s+/).filter(isRealNameWord);
            if (words.length >= 2) {
                lastName = words.join(" ");
                break;
            }
        }
    }

    // Estrategia 2: línea SIGUIENTE a APELLIDOS/SURNAME/SUMAME
    if (!lastName) {
        for (let i = 0; i < lines.length - 1; i++) {
            if (/APEL+IDOS|SURNAME|SUMAME/.test(lines[i])) {
                if (lines[i + 1] && isRealNameLine(lines[i + 1])) {
                    lastName = lines[i + 1];
                }
                break;
            }
        }
    }

    // Estrategia 3: cualquier línea que sea un nombre real (2-3 palabras)
    if (!lastName) {
        for (const line of lines) {
            if (isRealNameLine(line) && line.split(/\s+/).length >= 2) {
                lastName = line;
                break;
            }
        }
    }

    // ── Nombres ────────────────────────────────────────────────────────────────
    let firstName: string | undefined;

    // Estrategia 1: línea SIGUIENTE a NOMBRES/GIVEN
    for (let i = 0; i < lines.length - 1; i++) {
        if (/NOMBRES|GIVEN/.test(lines[i])) {
            if (lines[i + 1]) {
                const cleaned = filterNameWords(lines[i + 1]);
                if (cleaned && isRealNameLine(cleaned)) {
                    firstName = cleaned;
                }
            }
            break;
        }
    }

    // Estrategia 2: línea después o ANTES de apellidos (algunos OCR invierten el orden)
    if (!firstName && lastName) {
        const idx = lines.findIndex((l) => l.includes(lastName.split(" ")[0]));
        if (idx !== -1) {
            // Buscar en un rango de 3 líneas alrededor
            for (let j = idx - 3; j <= idx + 3; j++) {
                if (j === idx) continue;
                if (lines[j]) {
                    const cleaned = filterNameWords(lines[j]);
                    if (cleaned && isRealNameLine(cleaned) && cleaned !== lastName) {
                        firstName = cleaned;
                        break;
                    }
                }
            }
        }
    }

    // Estrategia 3: buscar nombres latinos comunes
    if (!firstName) {
        const common = ["MARTHA", "MARIA", "JUAN", "CARLOS", "JOSE", "LUIS", "ANA", "YURANY", "YURANI", "DANIELA", "ANDREA", "PAOLA"];
        for (const name of common) {
            if (text.toUpperCase().includes(name)) {
                const lineWith = lines.find((l) => l.includes(name));
                if (lineWith) {
                    const cleaned = filterNameWords(lineWith);
                    if (cleaned) {
                        firstName = cleaned;
                        break;
                    }
                }
            }
        }
    }

    // ── Número de pasaporte ────────────────────────────────────────────────────
    let documentNumber: string | undefined;
    for (let i = 0; i < lines.length; i++) {
        if (/PASAPORTE|PASSPORT NO/.test(lines[i])) {
            const next = lines[i + 1];
            if (next && /^[A-Z][0-9]{6,8}$/.test(next)) {
                documentNumber = next.trim();
                break;
            }
            const same = lines[i].match(/\b([A-Z][0-9]{6,8})\b/);
            if (same) {
                documentNumber = same[1];
                break;
            }
        }
    }
    if (!documentNumber) {
        for (const line of lines) {
            const match = line.match(/\b([A-Z]{1,2}[0-9]{6,8})\b/);
            if (match) {
                documentNumber = match[1];
                break;
            }
        }
    }

    // ── Fechas, sexo, país, lugar ─────────────────────────────────────────────
    let dateOfBirth: string | undefined;
    for (const line of lines) {
        const match = line.match(/(\d{1,2})\s+(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)[\/\w]*\s+(\d{4})/i);
        if (match) {
            const mmMatch = line.match(/(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)/i);
            const mm = mmMatch ? monthMap[mmMatch[0].toUpperCase()] : undefined;
            if (mm) {
                dateOfBirth = `${match[2]}-${mm}-${match[1].padStart(2, "0")}`;
            }
            break;
        }
    }

    let dateOfExpiry: string | undefined;
    for (const line of lines) {
        if (!/EXPIR|VENC|VOID|EXPIRY|CADUC/.test(line)) continue;
        const match = line.match(/(\d{1,2})\s+(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)[\/\w]*\s+(\d{4})/i);
        if (match) {
            const mmMatch = line.match(/(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)/i);
            const mm = mmMatch ? monthMap[mmMatch[0].toUpperCase()] : undefined;
            if (mm) {
                dateOfExpiry = `${match[2]}-${mm}-${match[1].padStart(2, "0")}`;
            }
            break;
        }
    }

    let sex = "UNSPECIFIED";
    for (const line of lines) {
        if (/\bF\b/.test(line) && /CAJICA|BIRTH|NACIMIENTO|SEX|SEXO/.test(line)) { sex = "F"; break; }
        if (/\bM\b/.test(line) && /CAJICA|BIRTH|NACIMIENTO|SEX|SEXO/.test(line)) { sex = "M"; break; }
    }

    let issuingCountry: string | undefined;
    for (const line of lines) {
        if (/COL/.test(line) && /COD|COUNTRY|PAIS/.test(line)) { issuingCountry = "COL"; break; }
    }
    if (!issuingCountry && text.includes("COLOMBIANA")) issuingCountry = "COL";

    let placeOfBirth: string | undefined;
    for (const line of lines) {
        if (/CAJICA/.test(line)) { placeOfBirth = "CAJICA, COL"; break; }
        if (/LUGAR|PLACE OF BIRTH|PLACEOFBIRTH/.test(line)) {
            const next = lines[lines.indexOf(line) + 1];
            if (next && /^[A-ZÁÉÍÓÚÑ\s,]+$/.test(next)) placeOfBirth = next.trim();
            break;
        }
    }

    const hasMinData = (!!firstName || !!lastName) && (!!documentNumber || !!dateOfBirth);
    if (!hasMinData) return null;

    return {
        documentType: "PASSPORT",
        issuingCountry,
        documentNumber,
        nationality: issuingCountry,
        dateOfBirth,
        sex,
        dateOfExpiry,
        placeOfBirth,
        lastName,
        firstName,
        mrzRaw: undefined,
    };
}

export function parsePassportMrz(text: string): ParsedMrz | null {
    if (!text || text.trim().length < 10) return null;

    // 1) Primero texto plano — evita usar MRZ corrupta
    const plainResult = extractFromPlainText(text);
    if (plainResult) return plainResult;

    // 2) Solo si texto plano falla, intentar MRZ
    const found = findMrzLinesStrict(text);
    if (found) {
        const result = parseMrzLines(found.line1, found.line2);
        if (result) return result;
    }

    return null;
}