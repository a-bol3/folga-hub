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
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: unknown): string {
  return clean(value).toLowerCase();
}

function normalizePhone(value: unknown): string {
  return clean(value).replace(/\s+/g, "");
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getValue(row: Record<string, unknown>, aliases: string[]): string {
  const normalizedAliases = aliases.map(normalizeHeader);
  const entries = Object.entries(row);

  for (const [key, value] of entries) {
    if (normalizedAliases.includes(normalizeHeader(key))) {
      return clean(value);
    }
  }

  return "";
}

function splitFullName(fullName: string) {
  const parts = fullName.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function buildObservations(row: Record<string, unknown>) {
  return Object.entries(row)
    .map(([key, value]) => `${key}: ${clean(value)}`)
    .filter((line) => !line.endsWith(":"))
    .join("\n");
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
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return { success: false, error: "Spreadsheet has no sheets." };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const fullName = getValue(row, [
          "name",
          "full name",
          "candidate",
          "candidato",
          "nombre completo",
          "data",
          "imie i nazwisko",
          "imię i nazwisko",
        ]);

        const explicitFirstName = getValue(row, [
          "first name",
          "firstname",
          "nombre",
          "imie",
          "imię",
        ]);

        const explicitLastName = getValue(row, [
          "last name",
          "lastname",
          "surname",
          "apellido",
          "nazwisko",
        ]);

        const split = splitFullName(fullName);

        const firstName = clean(explicitFirstName || split.firstName);
        const lastName = clean(explicitLastName || split.lastName);

        const email = normalizeEmail(
          getValue(row, ["email", "e mail", "mail", "correo"])
        );

        const phone = normalizePhone(
          getValue(row, [
            "phone",
            "telephone",
            "tel",
            "telefono",
            "teléfono",
            "mobile",
            "celular",
            "whatsapp",
          ])
        );

        if (!firstName || !lastName) {
          skippedCount++;
          continue;
        }

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

        const observations = buildObservations(row);

        if (existing) {
          await prisma.candidate.update({
            where: { id: existing.id },
            data: {
              firstName,
              lastName,
              email: existing.email || email || null,
              phone: existing.phone || phone || null,
              observations: observations || existing.observations,
            },
          });

          updatedCount++;
          continue;
        }

        await prisma.candidate.create({
          data: {
            firstName,
            lastName,
            email: email || null,
            phone: phone || null,
            status: "NEW",
            observations: observations || "Imported from Excel/CSV.",
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
          sheetName,
          totalRows: rows.length,
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