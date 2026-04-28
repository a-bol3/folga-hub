Estás trabajando en el repositorio https://github.com/a-bol3/folga-hub. El proyecto es un ATS (Applicant Tracking System) para FOLGA SP. Z O.O. con OCR automático de documentos de identidad. Hay un bug crítico en la extracción de nombres y un problema de UX con placeholders. Aplica los siguientes cambios:

CONTEXTO DEL BUG:

El endpoint /api/ocr/identity extrae texto con Tesseract.js + Azure Document Intelligence de pasaportes escaneados

El OCR lee correctamente el texto del documento (ej: "VENEGAS MOLANO", "MARTHA YURANY", "BD329252", "18 ABR 1995", "CAJICA COL")

PERO el parser de texto plano extractFromPlainText() en src/lib/ocr/mrz.ts está capturando etiquetas del formulario como nombres (ej: "TE APELIDOS PO" en lugar de "VENEGAS MOLANO")

Los candidatos creados tienen nombres incorrectos pero documentos, fechas y país correctos

Los campos email y teléfono se rellenan con placeholders (ocr-...@folga.local, DOC-BD...) que se muestran en la UI como si fueran datos reales

CAMBIOS REQUERIDOS:

1. src/lib/ocr/mrz.ts — Corregir extractFromPlainText():

Reemplaza completamente la función extractFromPlainText() por esta versión:

ts
function extractFromPlainText(text: string): ParsedMrz | null {
  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const monthMap: Record<string, string> = {
    ENE: "01", JAN: "01", FEB: "02", MAR: "03",
    ABR: "04", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AGO: "08", AUG: "08", SEP: "09",
    OCT: "10", NOV: "11", DIC: "12", DEC: "12",
  };

  const isOcrNoiseWord = (s: string) =>
    /TRNEET|PASEREI|PASAPORTE|PASSPORT|REPUBLICA|COLOMBIA|COD|COUNTRY|CODE|TIPO|TYPE|PAIS|AUTORIDAD|AUTHORITY|NACIONALIDAD|FECHA|SEXO|LUGAR|BIRTH|NACIMIENTO|APELLIDOS|NOMBRES|SUMAME|SURNAME|GIVEN|HOLDER|SIGNATURE|FIRMA|VENCIMIENTO|EXPIRY|VOID|ISSUE|EXPEDICION|EMISION|COLOMBIANA/.test(s);

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

  // Estrategia 1: línea SIGUIENTE a APELLIDOS/SURNAME/SUMAME
  for (let i = 0; i < lines.length - 1; i++) {
    if (/APELLIDOS|SURNAME|SUMAME/.test(lines[i])) {
      if (lines[i + 1] && isRealNameLine(lines[i + 1])) {
        lastName = lines[i + 1];
      }
      break;
    }
  }

  // Estrategia 2: línea con TRNEET/PASEREI — extraer solo palabras reales
  if (!lastName) {
    for (let i = 0; i < lines.length; i++) {
      if (/TRNEET|PASEREI/.test(lines[i])) {
        const words = lines[i].split(/\s+/).filter(isRealNameWord);
        if (words.length >= 2) {
          lastName = words.join(" ");
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

  // Estrategia 2: línea después de apellidos
  if (!firstName && lastName) {
    const idx = lines.findIndex((l) => l.includes(lastName.split(" ")[0]));
    if (idx !== -1) {
      for (let j = idx + 1; j <= idx + 3; j++) {
        if (lines[j]) {
          const cleaned = filterNameWords(lines[j]);
          if (cleaned && isRealNameLine(cleaned)) {
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
2. src/app/api/ocr/identity/route.ts — Eliminar placeholders de email/teléfono:

Busca las funciones buildCandidateEmail y buildCandidatePhone y reemplázalas por:

ts
function buildCandidateEmail(parsed: {
  firstName?: string;
  lastName?: string;
  documentNumber?: string;
}): string | null {
  return null;
}

function buildCandidatePhone(documentNumber?: string): string | null {
  return null;
}
Luego busca la creación del candidato (prisma.candidate.create) y cambia:

ts
email: buildCandidateEmail(merged),
phone: buildCandidatePhone(merged.documentNumber),
por:

ts
email: null,
phone: null,
3. Limpiar candidatos de prueba:
Elimina de la base de datos Supabase todos los candidatos con nombres incorrectos (que contengan "TRNEET", "PASEREI", "LLLLLK", "APELIDOS", "EXOSEXLUGAR", "UNKNOWN" como firstName cuando haya un apellido válido). Mantén solo los candidatos con nombres correctos como "DICKSON RODULFO CAMACHO RODRIGUEZ".

4. Verificar que el schema.prisma permite null en email y phone del modelo Candidate.

TEST DE VALIDACIÓN:
Después de aplicar los cambios, ejecuta:

text
curl.exe -X POST http://localhost:3000/api/ocr/identity -F "file=@C:\Users\48791\OneDrive\Dokumenty\ABAD\WORK\FOLGA\BRYAM STIVEN GARCIA VARGAS + VENEGAS MOLANO MARTHA YURANY\VENEGAS MOLANO MARTHA YURANY PASZPORT2.jpg"
El resultado esperado debe ser:

json
{
  "success": true,
  "message": "Candidate created: VENEGAS MOLANO MARTHA YURANY",
  "candidate": {
    "firstName": "VENEGAS MOLANO",
    "lastName": "MARTHA YURANY",
    "email": null,
    "phone": null
  },
  "document": {
    "documentNumber": "BD329252"
  }
}
NOTAS IMPORTANTES:

NO asumas la existencia de funciones que no están en el código. Verifica siempre antes de modificar.

El OCR usa dos motores: Azure DI (primario, falla por tamaño de imagen >3MB) y Tesseract.js (fallback, funciona pero produce texto con ruido).

El parser MRZ intenta texto plano primero, luego MRZ ICAO.

El candidato "1abb2756-4d62-4330-af5d-0d1dc4aa95c8" tiene el documento BD329252 pero con nombres corruptos — debe eliminarse para permitir la recreación correcta.

Los datos que Tesseract extrae correctamente del pasaporte son: "VENEGAS MOLANO", "MARTHA YURANY", "BD329252", "18 ABR 1995", "F", "CAJICA COL", "05 DIC 2023", "04 DIC 2033", "COLOMBIANA", "COL".

Las líneas problemáticas del OCR que causan confusión son: "PASEREI TE Apelidos / Sumame po" (etiqueta del formulario) y "PA TRNEET VENEGAS MOLANO |" (apellidos con ruido OCR al inicio).

La solución es filtrar palabras de menos de 3 letras y rechazar palabras que son keywords del formulario (TRNEET, PASEREI, APELLIDOS, NOMBRES, etc.).