import { TaskStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function ensureDemoData() {
  const manager =
    (await prisma.user.findFirst({ where: { role: "MANAGER" } })) ??
    (await prisma.user.create({
      data: {
        name: "Aisha Manager",
        email: "manager@workproof.ai",
        role: "MANAGER",
      },
    }));

  const employee =
    (await prisma.user.findFirst({ where: { role: "EMPLOYEE" } })) ??
    (await prisma.user.create({
      data: {
        name: "Omar Employee",
        email: "employee@workproof.ai",
        role: "EMPLOYEE",
      },
    }));

  const taskCount = await prisma.task.count();

  if (taskCount === 0) {
    await prisma.task.create({
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
        progressNotes: {
          create: {
            authorId: employee.id,
            content: "Mapped the checklist sections and gathered internal policy references.",
          },
        },
        proofItems: {
          create: {
            authorId: employee.id,
            label: "Draft checklist document",
            url: "https://example.com/workproof/checklist-draft",
          },
        },
      },
    });
  }

  return { manager, employee };
}
