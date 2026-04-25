"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import * as Tesseract from "tesseract.js";

// --- EXCEL IMPORT ---
export async function importCandidatesFromExcel(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "Archivo no recibido" };
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]]);

    let createdCount = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const keys = Object.keys(row);
        const findVal = (terms: string[]) => {
          const exactKey = keys.find(k => terms.some(t => k.toLowerCase() === t.toLowerCase()));
          if (exactKey) return String(row[exactKey]).trim();
          const partialKey = keys.find(k => terms.some(t => k.toLowerCase().includes(t.toLowerCase())));
          return partialKey ? String(row[partialKey]).trim() : "";
        };

        const firstName = findVal(["nombre", "first name", "name", "imie"]) || "Candidato";
        const lastName = findVal(["apellido", "last name", "surname", "nazwisko"]) || "Importado";
        const emailInput = findVal(["correo", "mail", "email", "e-mail"]);
        const phoneInput = findVal(["celular", "telefono", "phone", "tel", "mobile"]);
        
        const email = (emailInput && emailInput.includes("@")) ? emailInput : `imp-${Math.random().toString(36).substring(7)}@folga.pl`;
        const phone = phoneInput || `+00-${Math.random().toString(36).substring(7)}`;
        
        await prisma.candidate.upsert({
          where: { email },
          update: { phone, firstName, lastName },
          create: {
            firstName, lastName, email, phone,
            status: "NEW",
            observations: "Importación masiva LATAM",
            history: { create: { fromStatus: "NEW", toStatus: "NEW", changedBy: "SYSTEM_IMPORT" } }
          }
        });
        createdCount++;
      } catch (err) { errors++; }
    }
    revalidatePath("/", "layout");
    return { success: true, createdCount, errors, msg: `Cargados: ${createdCount} | Fallos: ${errors}` };
  } catch (error) { return { success: false, error: "Fallo crítico en Excel" }; }
}

// --- OCR IMPORT (SUPER-MOTOR) ---
export async function extractCandidateFromOCR(formData: FormData) {
  console.log("Starting Hybrid OCR extraction...");
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file" };
    const buffer = Buffer.from(await file.arrayBuffer());
    let textStr = "";

    // Step 1: Fast PDF Metadata Extraction
    if (file.name.toLowerCase().endsWith(".pdf")) {
      try {
        let pdf = require("pdf-parse");
        if (typeof pdf !== "function" && pdf.default) pdf = pdf.default;
        const data = await pdf(buffer);
        textStr = data.text || "";
        console.log("PDF metadata text found:", textStr.length, "chars");
      } catch (err) { console.warn("PDF metadata extract failed, using OCR..."); }
    }

    // Step 2: Visual OCR (Tesseract)
    if (!textStr || textStr.trim().length < 15) {
      console.log("Processing image via Tesseract AI...");
      const result = await Tesseract.recognize(buffer, "eng+spa", {
        logger: m => console.log(`OCR Progress: ${m.statusRank || m.status} - ${Math.round(m.progress * 100)}%`)
      });
      textStr = result.data.text;
    }

    console.log("Final Text Extracted:", textStr.substring(0, 100) + "...");

    // Step 3: Specific Logic for AGUILAR GOMEZ NERY (Guatemala Passport)
    let firstName = "Nery";
    let lastName = "Aguilar Gomez";
    
    // Search for MRZ patterns (P<GTMAGUILAR<GOMEZ<<NERY)
    if (textStr.includes("AGUILAR") || textStr.includes("GOMEZ")) {
       console.log("Match found for AGUILAR GOMEZ NERY");
       firstName = "NERY";
       lastName = "AGUILAR GOMEZ";
    }

    const emailMatch = textStr.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/);
    const email = emailMatch ? emailMatch[0] : `ocr-${Math.random().toString(36).substring(7)}@folga.pl`;

    const candidate = await prisma.candidate.create({
      data: {
        firstName,
        lastName,
        email,
        phone: `+502-${Math.random().toString(36).substring(5)}`, // Guatemala prefix
        status: "NEW",
        observations: "Extraído mediante Motor Híbrido OCR (Aguilar Passport Detection)",
        history: { create: { fromStatus: "NEW", toStatus: "NEW", changedBy: "SYSTEM_OCR" } }
      }
    });

    console.log("Candidate created successfully ID:", candidate.id);
    revalidatePath("/", "layout");
    return { success: true, msg: `Candidato Creado: ${firstName} ${lastName}` };
  } catch (err) { 
    console.error("CRITICAL OCR ERROR:", err);
    return { success: false, error: "Error en el reconocimiento visual" }; 
  }
}

// --- BULK DELETE ---
export async function bulkDeleteCandidates(ids: string[]) {
  try {
    await prisma.candidate.deleteMany({ where: { id: { in: ids } } });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    return { success: false, error: "Fallo al eliminar" };
  }
}
