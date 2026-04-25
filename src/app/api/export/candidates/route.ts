import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "csv";

  try {
    const candidates = await prisma.candidate.findMany({
      orderBy: { createdAt: "desc" },
    });

    const data = candidates.map((c) => ({
      ID: c.id,
      "First Name": c.firstName,
      "Last Name": c.lastName,
      Email: c.email,
      Phone: c.phone,
      Status: c.status,
      "Date of Birth": c.dateOfBirth ? c.dateOfBirth.toISOString().split("T")[0] : "",
      Citizenship: c.citizenship,
      "Created At": c.createdAt.toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");

    if (format === "xlsx") {
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition": "attachment; filename=candidates.xlsx",
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    } else {
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return new NextResponse(csv, {
        headers: {
          "Content-Disposition": "attachment; filename=candidates.csv",
          "Content-Type": "text/csv",
        },
      });
    }
  } catch (error) {
    console.error("Export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
