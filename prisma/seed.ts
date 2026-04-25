import { PrismaClient, CandidateStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");

  // Create an Admin User
  const admin = await prisma.user.upsert({
    where: { email: "admin@folga.com" },
    update: {},
    create: {
      email: "admin@folga.com",
      role: "ADMIN",
    },
  });

  // Create Candidates
  const candidates = [
    {
      firstName: "Ivan",
      lastName: "Ivanov",
      email: "ivanov@example.com",
      phone: "+79001234567",
      status: CandidateStatus.NEW,
      citizenship: "Russian",
      education: "Ingeniería de Software",
      observations: "Candidato con perfil técnico muy fuerte.",
    },
    {
      firstName: "Marta",
      lastName: "García",
      email: "marta@folga.com",
      phone: "+34600112233",
      status: CandidateStatus.INTERVIEW,
      citizenship: "Spanish",
      education: "Relaciones Internacionales",
      observations: "Fluidez en 3 idiomas. Experiencia en el sector logístico.",
    },
    {
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@talent.io",
      phone: "+15551234455",
      status: CandidateStatus.APPROVED,
      citizenship: "USA",
      education: "Master in Business",
      observations: "Referido por operaciones locales.",
    },
    {
      firstName: "Olga",
      lastName: "Petrova",
      email: "olga.p@yandex.ru",
      phone: "+79009998877",
      status: CandidateStatus.PENDING_DOCS,
      citizenship: "Russian",
      education: "Administración de Empresas",
    },
  ];

  for (const c of candidates) {
    const candidate = await prisma.candidate.upsert({
      where: { email: c.email },
      update: {},
      create: c,
    });

    // Add a default status history
    await prisma.statusHistory.create({
      data: {
        candidateId: candidate.id,
        fromStatus: CandidateStatus.NEW,
        toStatus: c.status,
        changedBy: "SYSTEM_SEED",
      },
    });

    // Add a note for John Smith
    if (c.firstName === "John") {
      await prisma.note.create({
        data: {
          candidateId: candidate.id,
          userId: admin.id,
          content: "Perfil aprobado tras revisión inicial. Pendiente de contrato.",
        },
      });
    }
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
