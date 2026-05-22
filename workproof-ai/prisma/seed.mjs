import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Role, TaskStatus } from "../src/generated/prisma/client.ts";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.proofItem.deleteMany();
  await prisma.progressNote.deleteMany();
  await prisma.workSession.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  const manager = await prisma.user.create({
    data: {
      name: "Aisha Manager",
      email: "manager@workproof.ai",
      role: Role.MANAGER,
    },
  });

  const employee = await prisma.user.create({
    data: {
      name: "Omar Employee",
      email: "employee@workproof.ai",
      role: Role.EMPLOYEE,
    },
  });

  const task = await prisma.task.create({
    data: {
      title: "Prepare onboarding checklist",
      description:
        "Draft the first version of the onboarding checklist, collect source links, and document progress evidence for manager review.",
      status: TaskStatus.IN_PROGRESS,
      managerId: manager.id,
      assigneeId: employee.id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      aiSummary:
        "Mock AI summary: The onboarding checklist task has initial progress and needs final proof links before review.",
    },
  });

  await prisma.progressNote.create({
    data: {
      taskId: task.id,
      authorId: employee.id,
      content: "Mapped the checklist sections and gathered internal policy references.",
    },
  });

  await prisma.proofItem.create({
    data: {
      taskId: task.id,
      authorId: employee.id,
      label: "Draft checklist document",
      url: "https://example.com/workproof/checklist-draft",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
