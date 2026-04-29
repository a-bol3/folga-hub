import { normalizeIdentity, type NormalizedIdentity } from "@/lib/ocr/normalize-identity";

export type HrappkaDocumentType =
    | "PASSPORT"
    | "KARTA_POBYTU"
    | "PESEL_NOTIFICATION"
    | "VOIVODESHIP_DECISION"
    | "IDENTITY_DOCUMENT"
    | "UNKNOWN";

export type HrappkaExtractedDocument = NormalizedIdentity & {
    detectedDocumentType: HrappkaDocumentType;
    fullName?: string;
    pesel?: string;
    permitType?: string;
    permitNumber?: string;
    accessToLabourMarket?: string;
    dateOfPermitIssue?: string;
    dateOfPermitExpiry?: string;
    issuingAuthority?: string;
    addressOfRegistration?: string;
    height?: string;
    eyeColor?: string;
    fatherName?: string;
    motherName?: string;
    parentsForenames?: string;
    employerName?: string;
    employerAddress?: string;
    decisionNumber?: string;
    decisionDate?: string;
    caseNumber?: string;
    workPermitFrom?: string;
    workPermitTo?: string;
    position?: string;
    salary?: string;
    rawText?: string;
};

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
    DIC: "12"
};

function cleanText(text: string) {
    return text
        .toUpperCase()
        .replace(/[^\p{L}\p{N}<\s/.,:;()\-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanValue(value?: string | null) {
    if (!value) return undefined;
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeDate(value?: string | null): string | undefined {
    if (!value) return undefined;

    const text = value.toUpperCase().replace(/\s+/g, " ").trim();

    const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const dotted = text.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
    if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;

    const spaced = text.match(
        /\b(\d{2})\s+([A-Z]{3})(?:\/[A-Z]{3})?\s+(\d{4})\b/
    );

    if (spaced) {
        const month = MONTHS[spaced[2]];
        if (month) return `${spaced[3]}-${month}-${spaced[1]}`;
    }

    const compact = text.match(/\b(\d{2})\s(\d{2})\s(\d{4})\b/);
    if (compact) return `${compact[3]}-${compact[2]}-${compact[1]}`;

    return undefined;
}

function valueAfter(text: string, labels: string[], stops: string[]) {
    for (const label of labels) {
        const index = text.indexOf(label);
        if (index < 0) continue;

        const after = text.slice(index + label.length).trim();
        let end = after.length;

        for (const stop of stops) {
            const stopIndex = after.indexOf(stop);
            if (stopIndex >= 0 && stopIndex < end) end = stopIndex;
        }

        return cleanValue(after.slice(0, end));
    }

    return undefined;
}

function detectDocumentType(text: string): HrappkaDocumentType {
    const t = cleanText(text);

    if (t.includes("KARTA POBYTU") || t.includes("RESIDENCE PERMIT")) {
        return "KARTA_POBYTU";
    }

    if (
        t.includes("POWIADOMIENIE O NADANIU NUMERU PESEL") ||
        t.includes("NADANY NUMER PESEL")
    ) {
        return "PESEL_NOTIFICATION";
    }

    if (
        t.includes("ZEZWOLENIA NA POBYT") ||
        t.includes("WOJEWODA") ||
        t.includes("DECYZJA")
    ) {
        return "VOIVODESHIP_DECISION";
    }

    if (t.includes("PASSPORT") || t.includes("PASAPORTE") || t.includes("P<COL") || t.includes("P<GTM")) {
        return "PASSPORT";
    }

    return "UNKNOWN";
}

function parseSex(text: string) {
    const t = cleanText(text);

    if (/\b(M|MALE|MĘŻCZYZNA|MASCULINO)\b/.test(t)) return "M";
    if (/\b(F|FEMALE|KOBIETA|FEMENINO)\b/.test(t)) return "F";

    return undefined;
}

function splitName(fullName?: string) {
    const value = cleanValue(fullName);
    if (!value) return {};

    const parts = value.split(" ").filter(Boolean);

    if (parts.length <= 1) {
        return { firstName: value };
    }

    return {
        firstName: parts.slice(0, Math.ceil(parts.length / 2)).join(" "),
        lastName: parts.slice(Math.ceil(parts.length / 2)).join(" ")
    };
}

function parseColombianPassport(text: string): Partial<HrappkaExtractedDocument> {
    const t = cleanText(text);

    const mrzName = t.match(/P<COL([A-Z<]+)<<([A-Z<]+)/);
    const documentNumber =
        t.match(/\bB[A-Z0-9]\d{5,8}\b/)?.[0] ||
        t.match(/\bBD\d{6,8}\b/)?.[0] ||
        t.match(/\bBF\d{6,8}\b/)?.[0];

    const identityNumber = t.match(/\bCC\d{7,12}\b/)?.[0];

    const lastName =
        mrzName?.[1]?.replace(/</g, " ").trim() ||
        valueAfter(t, ["APELLIDOS SURNAME", "SURNAME"], [
            "NOMBRES",
            "GIVEN",
            "NACIONALIDAD",
            "NATIONALITY"
        ]);

    const firstName =
        mrzName?.[2]?.replace(/</g, " ").trim() ||
        valueAfter(t, ["NOMBRES GIVEN NAMES", "GIVEN NAMES"], [
            "NACIONALIDAD",
            "NATIONALITY",
            "FECHA",
            "DATE"
        ]);

    const dobRaw = t.match(
        /\b\d{2}\s+(ENE|JAN|FEB|MAR|ABR|APR|MAY|JUN|JUL|AGO|AUG|SEP|OCT|NOV|DIC|DEC)(?:\/[A-Z]{3})?\s+\d{4}\b/
    )?.[0];

    const dates = Array.from(
        t.matchAll(
            /\b\d{2}\s+(ENE|JAN|FEB|MAR|ABR|APR|MAY|JUN|JUL|AGO|AUG|SEP|OCT|NOV|DIC|DEC)(?:\/[A-Z]{3})?\s+\d{4}\b/g
        )
    ).map((m) => normalizeDate(m[0]));

    return {
        detectedDocumentType: "PASSPORT",
        documentType: "PASSPORT",
        issuingCountry: "COL",
        nationality: "COL",
        firstName,
        lastName,
        documentNumber,
        identityNumber,
        dateOfBirth: normalizeDate(dobRaw),
        dateOfIssue: dates[1],
        dateOfExpiry: dates[2],
        sex: parseSex(t),
        placeOfBirth: t.match(/\b[A-ZÁÉÍÓÚÑ ]+\s+COL\b/)?.[0],
        confidence: firstName && lastName && documentNumber ? 0.92 : 0.55,
        source: "TEXT_FALLBACK"
    };
}

function parseGuatemalaPassport(text: string): Partial<HrappkaExtractedDocument> {
    const t = cleanText(text);

    if (!t.includes("GUATEMALA") && !t.includes("GTM")) return {};

    const documentNumber =
        t.match(/\b\d{9}\b/)?.[0] ||
        t.match(/\b\d{3,6}\s+\d{6,9}\b/)?.[0]?.replace(/\s+/g, "");

    const identityNumber =
        t.match(/\b\d{13}\b/)?.[0] ||
        valueAfter(t, ["IDENTIDAD NO", "ID NO"], ["SEXO", "SEX", "LUGAR"]);

    const lastName = valueAfter(t, ["APELLIDOS SURNAME"], ["NOMBRES", "GIVEN"]);
    const firstName = valueAfter(t, ["NOMBRES GIVEN NAMES"], ["NACIONALIDAD", "NATIONALITY"]);

    const dates = Array.from(
        t.matchAll(
            /\b\d{2}\s+(ENE|JAN|FEB|MAR|ABR|APR|MAY|JUN|JUL|AGO|AUG|SEP|OCT|NOV|DIC|DEC)(?:\/[A-Z]{3})?\s+\d{2,4}\b/g
        )
    ).map((m) => {
        const v = m[0].replace(/\b(\d{2})$/, "20$1");
        return normalizeDate(v);
    });

    return {
        detectedDocumentType: "PASSPORT",
        documentType: "PASSPORT",
        issuingCountry: "GTM",
        nationality: "GTM",
        firstName,
        lastName,
        documentNumber,
        identityNumber,
        dateOfBirth: dates[0],
        dateOfIssue: dates[1],
        dateOfExpiry: dates[2],
        sex: parseSex(t),
        placeOfBirth: valueAfter(t, ["LUGAR DE NACIMIENTO PLACE OF BIRTH"], [
            "FECHA",
            "DATE",
            "AUTORIDAD"
        ]),
        confidence: firstName && lastName && documentNumber ? 0.9 : 0.55,
        source: "TEXT_FALLBACK"
    };
}

function parseKartaPobytu(text: string): Partial<HrappkaExtractedDocument> {
    const t = cleanText(text);

    if (!t.includes("KARTA POBYTU") && !t.includes("RESIDENCE PERMIT")) return {};

    const cardNumber =
        t.match(/\b[A-Z]{1,3}\d{6,10}\b/)?.[0] ||
        t.match(/\bRS\d{6,10}\b/)?.[0];

    const fullName = valueAfter(t, ["NAZWISKO I IMIĘ IMIONA SURNAME AND FORENAME S"], [
        "PŁEĆ",
        "SEX",
        "OBYWATELSTWO",
        "NATIONALITY"
    ]);

    const nameParts = splitName(fullName);

    const pesel =
        t.match(/\b\d{11}\b/)?.[0] ||
        valueAfter(t, ["NUMER EWIDENCYJNY PESEL", "PERSONAL NUMBER PESEL"], [
            "KOLOR",
            "COLOUR",
            "WZROST",
            "HEIGHT"
        ]);

    const dates = Array.from(t.matchAll(/\b\d{2}\s\d{2}\s\d{4}\b/g)).map((m) =>
        normalizeDate(m[0])
    );

    return {
        detectedDocumentType: "KARTA_POBYTU",
        documentType: "KARTA_POBYTU",
        documentNumber: cardNumber,
        permitNumber: cardNumber,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        nationality: valueAfter(t, ["OBYWATELSTWO NATIONALITY"], ["DATA", "DATE", "RODZAJ"]),
        sex: parseSex(t),
        dateOfBirth: dates[0],
        dateOfExpiry: dates[1],
        permitType: valueAfter(t, ["RODZAJ ZEZWOLENIA TYPE OF PERMIT"], [
            "DATA WAŻNOŚCI",
            "DATE OF EXPIRY",
            "PODPIS"
        ]),
        accessToLabourMarket: valueAfter(t, ["UWAGI REMARKS"], [
            "DATA WYDANIA",
            "DATE OF ISSUE"
        ]),
        dateOfIssue: dates[2],
        issuingAuthority: valueAfter(t, ["ORGAN WYDAJĄCY", "ISSUING AUTHORITY"], [
            "MIEJSCE",
            "PLACE",
            "ADRES"
        ]),
        placeOfBirth: valueAfter(t, ["MIEJSCE I KRAJ URODZENIA PLACE AND COUNTRY OF BIRTH"], [
            "ADRES",
            "ADDRESS"
        ]),
        addressOfRegistration: valueAfter(t, ["ADRES ZAMELDOWANIA ADDRESS OF REGISTRATION"], [
            "NUMER EWIDENCYJNY",
            "PESEL"
        ]),
        pesel,
        height: valueAfter(t, ["WZROST HEIGHT"], ["IMIONA", "PARENTS"]),
        eyeColor: valueAfter(t, ["KOLOR OCZU COLOUR OF EYES"], ["WZROST", "HEIGHT"]),
        parentsForenames: valueAfter(t, ["IMIONA RODZICÓW PARENTS FORENAMES"], [
            "PODPIS",
            "SIGNATURE"
        ]),
        confidence: cardNumber && fullName ? 0.9 : 0.6,
        source: "TEXT_FALLBACK"
    };
}

function parsePeselNotification(text: string): Partial<HrappkaExtractedDocument> {
    const t = cleanText(text);

    if (!t.includes("NADANIU NUMERU PESEL") && !t.includes("NADANY NUMER PESEL")) return {};

    const pesel =
        valueAfter(t, ["NUMER PESEL"], ["PODSTAWA", "PRAWNA"]) ||
        t.match(/\b\d{11}\b/)?.[0];

    const firstName = valueAfter(t, ["IMIĘ IMIONA"], ["NAZWISKO"]);
    const lastName = valueAfter(t, ["NAZWISKO"], ["NAZWISKO RODOWE", "DATA URODZENIA"]);
    const dateOfBirth = normalizeDate(valueAfter(t, ["DATA URODZENIA"], ["MIEJSCE URODZENIA"]));
    const placeOfBirth = valueAfter(t, ["MIEJSCE URODZENIA"], ["PŁEĆ", "PLEC"]);
    const sex = parseSex(t);
    const fatherName = valueAfter(t, ["IMIĘ OJCA PIERWSZE"], ["IMIĘ MATKI"]);
    const motherName = valueAfter(t, ["IMIĘ MATKI PIERWSZE"], ["NAZWISKO RODOWE"]);
    const documentNumber = valueAfter(t, ["RODZAJ SERIA I NUMER DOKUMENTU"], [
        "OBYWATELSTWO",
        "STATUS"
    ]);

    return {
        detectedDocumentType: "PESEL_NOTIFICATION",
        documentType: "PESEL_NOTIFICATION",
        firstName,
        lastName,
        pesel,
        identityNumber: pesel,
        documentNumber,
        dateOfBirth,
        placeOfBirth,
        sex,
        fatherName,
        motherName,
        nationality: valueAfter(t, ["OBYWATELSTWO"], ["STATUS"]),
        confidence: firstName && lastName && pesel ? 0.92 : 0.6,
        source: "TEXT_FALLBACK"
    };
}

function parseVoivodeshipDecision(text: string): Partial<HrappkaExtractedDocument> {
    const t = cleanText(text);

    if (!t.includes("DECYZJA") && !t.includes("WOJEWODA")) return {};

    const fullName =
        t.match(/\b[A-ZŁŚŻŹĆŃÓĘĄ]{2,}\s+[A-ZŁŚŻŹĆŃÓĘĄ]{2,}\s+[A-ZŁŚŻŹĆŃÓĘĄ]{2,}\b/)?.[0] ||
        undefined;

    const nameParts = splitName(fullName);

    return {
        detectedDocumentType: "VOIVODESHIP_DECISION",
        documentType: "VOIVODESHIP_DECISION",
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        decisionNumber:
            t.match(/\b[A-Z]{1,5}[./-]?[A-Z0-9./-]{5,}\b/)?.[0],
        decisionDate: normalizeDate(t.match(/\b\d{2}[./-]\d{2}[./-]\d{4}\b/)?.[0]),
        issuingAuthority:
            t.match(/\bWOJEWODA\s+[A-ZŁŚŻŹĆŃÓĘĄ]+\b/)?.[0] ||
            valueAfter(t, ["Z UP", "WOJEWODA"], ["UZASADNIENIE", "POUCZENIE"]),
        rawText: text,
        confidence: fullName ? 0.65 : 0.4,
        source: "TEXT_FALLBACK"
    };
}

export function extractHrappkaDocumentData(
    text: string,
    baseIdentity?: Partial<NormalizedIdentity> | null
): HrappkaExtractedDocument {
    const clean = cleanText(text);
    const detectedDocumentType = detectDocumentType(clean);

    const candidates = [
        parseColombianPassport(clean),
        parseGuatemalaPassport(clean),
        parseKartaPobytu(clean),
        parsePeselNotification(clean),
        parseVoivodeshipDecision(clean)
    ];

    const bestFallback = candidates
        .filter((candidate) => Object.keys(candidate).length > 0)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];

    const merged = normalizeIdentity({
        ...bestFallback,
        ...baseIdentity,
        documentType:
            baseIdentity?.documentType ||
            bestFallback?.documentType ||
            detectedDocumentType ||
            "UNKNOWN",
        firstName: baseIdentity?.firstName || bestFallback?.firstName,
        lastName: baseIdentity?.lastName || bestFallback?.lastName,
        documentNumber: baseIdentity?.documentNumber || bestFallback?.documentNumber,
        identityNumber: baseIdentity?.identityNumber || bestFallback?.identityNumber,
        issuingCountry: baseIdentity?.issuingCountry || bestFallback?.issuingCountry,
        nationality: baseIdentity?.nationality || bestFallback?.nationality,
        sex: baseIdentity?.sex || bestFallback?.sex,
        dateOfBirth: baseIdentity?.dateOfBirth || bestFallback?.dateOfBirth,
        dateOfIssue: baseIdentity?.dateOfIssue || bestFallback?.dateOfIssue,
        dateOfExpiry: baseIdentity?.dateOfExpiry || bestFallback?.dateOfExpiry,
        placeOfBirth: baseIdentity?.placeOfBirth || bestFallback?.placeOfBirth,
        confidence: Math.max(baseIdentity?.confidence || 0, bestFallback?.confidence || 0),
        source: baseIdentity?.source || bestFallback?.source || "TEXT_FALLBACK"
    });

    return {
        ...bestFallback,
        ...merged,
        detectedDocumentType:
            (bestFallback?.detectedDocumentType as HrappkaDocumentType) ||
            detectedDocumentType,
        fullName:
            merged.firstName && merged.lastName
                ? `${merged.firstName} ${merged.lastName}`
                : undefined,
        rawText: text
    };
}