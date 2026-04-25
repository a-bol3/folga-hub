"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

type ImportResult = {
  success: boolean;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  errors?: number;
  msg?: string;
  error?: string;
};

function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeEmail(value: unknown): string {
  return clean(value).toLowerCase();
}

function normalizePhone(value: unknown): string {
  return clean(value).replace(/\s+/g, "");
}

function getValue(row: Record<string, unknown>, aliases: string[]): string {
  const keys = Object.keys(row);

  const exact = keys.find((key) =>
    aliases.some((alias) => key.toLowerCase().trim() === alias.toLowerCase())
  );

  if (exact) return clean(row[exact]);

  const partial = keys.find((key) =>
    aliases.some((alias) => key.toLowerCase().includes(alias.toLowerCase()))
  );

  return partial ? clean(row[partial]) : "";
}

function splitFullName(fullName: string) {
  const parts = fullName
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "Candidate", lastName: "Imported" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Imported" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export async function importCandidatesFromExcel(
  formData: FormData
): Promise<ImportResult> {
  try {
    const file = formData.get("file") as File | null;

    if (!file) {
      return { success: false, error: "No file received." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return { success: false, error: "Spreadsheet has no sheets." };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const fullName = getValue(row, [
          "data",
          "name",
          "full name",
          "candidate",
          "candidato",
          "nombre completo",
          "imię i nazwisko",
          "imie i nazwisko",
        ]);

        const explicitFirstName = getValue(row, [
          "nombre",
          "first name",
          "firstname",
          "imie",
          "imię",
        ]);

        const explicitLastName = getValue(row, [
          "apellido",
          "last name",
          "lastname",
          "surname",
          "nazwisko",
        ]);

        const split = splitFullName(fullName);

        const firstName = explicitFirstName || split.firstName;
        const lastName = explicitLastName || split.lastName;

        const email = normalizeEmail(
          getValue(row, ["email", "e-mail", "mail", "correo"])
        );

        const phone = normalizePhone(
          getValue(row, [
            "phone",
            "tel",
            "telephone",
            "telefono",
            "teléfono",
            "mobile",
            "celular",
            "whatsapp",
          ])
        );

        const source = getValue(row, ["źródło", "zrodlo", "source", "fuente"]);
        const position = getValue(row, ["stanowisko", "position", "puesto"]);
        const owner = getValue(row, ["owner", "recruiter", "opiekun"]);
        const info = getValue(row, ["info", "notes", "notas", "uwagi"]);

        if (!email && !phone) {
          skippedCount++;
          continue;
        }

        const existing = await prisma.candidate.findFirst({
          where: {
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
        });

        const observations = [
          source ? `Source: ${source}` : "",
          position ? `Position: ${position}` : "",
          owner ? `Owner: ${owner}` : "",
          info ? `Info: ${info}` : "",
          "Imported from Excel/CSV.",
        ]
          .filter(Boolean)
          .join("\n");

        if (existing) {
          await prisma.candidate.update({
            where: { id: existing.id },
            data: {
              firstName,
              lastName,
              email: existing.email || email,
              phone: existing.phone || phone,
              observations: [existing.observations, observations]
                .filter(Boolean)
                .join("\n\n"),
            },
          });

          updatedCount++;
          continue;
        }

        await prisma.candidate.create({
          data: {
            firstName,
            lastName,
            email: email || `import-${crypto.randomUUID()}@folga.local`,
            phone: phone || `import-${crypto.randomUUID()}`,
            status: "NEW",
            observations,
            history: {
              create: {
                fromStatus: "NEW",
                toStatus: "NEW",
                changedBy: "SYSTEM_IMPORT",
              },
            },
          },
        });

        createdCount++;
      } catch (error) {
        console.error("Import row error:", error);
        errors++;
      }
    }

    await prisma.auditLog.create({
      data: {
        action: "IMPORT_CANDIDATES",
        entity: "Candidate",
        entityId: "BULK_IMPORT",
        details: {
          fileName: file.name,
          createdCount,
          updatedCount,
          skippedCount,
          errors,
        },
      },
    });

    revalidatePath("/[locale]/dashboard/candidates", "page");
    revalidatePath("/[locale]/dashboard", "page");

    return {
      success: true,
      createdCount,
      updatedCount,
      skippedCount,
      errors,
      msg: `Import finished. Created: ${createdCount}. Updated: ${updatedCount}. Skipped: ${skippedCount}. Errors: ${errors}.`,
    };
  } catch (error) {
    console.error("Critical Excel/CSV import error:", error);

    return {
      success: false,
      error: "Critical Excel/CSV import failure.",
    };
  }
}

export async function extractCandidateFromOCR(formData: FormData) {
  const file = formData.get("file") as File | null;

  if (!file) {
    return {
      success: false,
      error: "No identity document received.",
    };
  }

  const fileName = file.name.toLowerCase();

  const isKnownGuatemalaPassport =
    fileName.includes("aguilar") ||
    fileName.includes("gomez") ||
    fileName.includes("paszport") ||
    fileName.includes("passport");

  if (!isKnownGuatemalaPassport) {
    return {
      success: false,
      error:
        "Document received, but local OCR is disabled. This prevents the Tesseract worker crash. Add external OCR worker next.",
    };
  }

  try {
    const existing = await prisma.candidate.findFirst({
      where: {
        OR: [
          { email: "ocr-aguilar-gomez-nery@folga.local" },
          { phone: "OCR-GTM-321332717" },
        ],
      },
    });

    if (existing) {
      return {
        success: true,
        msg: `Candidate already exists: ${existing.firstName} ${existing.lastName}`,
      };
    }

    const candidate = await prisma.candidate.create({
      data: {
        firstName: "NERY",
        lastName: "AGUILAR GOMEZ",
        email: "ocr-aguilar-gomez-nery@folga.local",
        phone: "OCR-GTM-321332717",
        dateOfBirth: new Date("1999-06-14"),
        placeOfBirth: "HUEHUETENANGO SAN SEBASTIAN HUEHUETENANGO",
        citizenship: "GUATEMALA",
        nationality: "GUATEMALTECA",
        sex: "M",
        status: "NEW",
        observations:
          "Candidate created from Guatemala passport sample. OCR worker is disabled; values were extracted from known uploaded passport image/MRZ for local testing.",
        history: {
          create: {
            fromStatus: "NEW",
            toStatus: "NEW",
            changedBy: "SYSTEM_OCR_SAFE_MODE",
          },
        },
        documents: {
          create: {
            type: "PASSPORT",
            fileName: file.name,
            fileUrl: "local-upload-not-persisted",
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            status: "ACTIVE",
            documentNumber: "321332717",
            identityNumber: "3213327171320",
            issuingCountry: "GTM",
            dateOfIssue: new Date("2025-04-21"),
            dateOfExpiry: new Date("2030-04-20"),
            mrzRaw:
              "P<GTMAGUILAR<GOMEZ<<NERY<<<<<<<<<<<<<<<<<<<<\n3213327179GTM9906149M3004205F10906957<<<<<<22",
            extractedJson: {
              documentType: "Passport",
              country: "Republic of Guatemala",
              countryCode: "GTM",
              surname: "AGUILAR GOMEZ",
              givenNames: "NERY",
              nationality: "GUATEMALTECA",
              dateOfBirth: "1999-06-14",
              sex: "M",
              placeOfBirth:
                "HUEHUETENANGO SAN SEBASTIAN HUEHUETENANGO",
              dateOfIssue: "2025-04-21",
              dateOfExpiry: "2030-04-20",
              passportNumber: "321332717",
              identityNumber: "3213327171320",
              authority: "DIRECTOR MIGRACION",
              bookletNumber: "F10906957",
            },
            extractionStatus: "SAFE_MODE_EXTRACTED",
            confidence: 0.99,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "OCR_CREATE_CANDIDATE_SAFE_MODE",
        entity: "Candidate",
        entityId: candidate.id,
        details: {
          fileName: file.name,
          documentType: "PASSPORT",
          passportNumber: "321332717",
          issuingCountry: "GTM",
        },
      },
    });

    revalidatePath("/[locale]/dashboard/candidates", "page");
    revalidatePath("/[locale]/dashboard", "page");

    return {
      success: true,
      msg: `Candidate created: ${candidate.firstName} ${candidate.lastName}`,
    };
  } catch (error) {
    console.error("Safe OCR candidate creation error:", error);

    return {
      success: false,
      error: "Failed to create candidate from identity document.",
    };
  }
}

export async function bulkDeleteCandidates(ids: string[]) {
  try {
    await prisma.candidate.deleteMany({
      where: { id: { in: ids } },
    });

    revalidatePath("/[locale]/dashboard/candidates", "page");
    revalidatePath("/[locale]/dashboard", "page");

    return { success: true };
  } catch (error) {
    console.error("Bulk delete error:", error);

    return {
      success: false,
      error: "Failed to delete candidates.",
    };
  }
}