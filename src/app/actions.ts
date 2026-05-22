"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TaskStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function demoManagerId() {
  const manager = await prisma.user.findFirstOrThrow({
    where: { role: "MANAGER" },
    select: { id: true },
  });
  return manager.id;
}

async function demoEmployeeId() {
  const employee = await prisma.user.findFirstOrThrow({
    where: { role: "EMPLOYEE" },
    select: { id: true },
  });
  return employee.id;
}

function mockAiSummary(title: string, notes: string[]) {
  const noteText = notes.length
    ? `Recent progress: ${notes.slice(0, 3).join(" ")}`
    : "No progress notes have been added yet.";
  return `Mock AI summary: ${title} is ready for review context. ${noteText}`;
}

export async function createTask(formData: FormData) {
  const title = field(formData, "title");
  const description = field(formData, "description");
  const assigneeId = Number(field(formData, "assigneeId"));
  const dueDate = field(formData, "dueDate");

  if (!title || !description || !assigneeId) return;

  await prisma.task.create({
    data: {
      title,
      description,
      assigneeId,
      managerId: await demoManagerId(),
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
      aiSummary: mockAiSummary(title, []),
    },
  });

  revalidatePath("/manager");
  revalidatePath("/employee");
}

export async function startSession(taskId: number) {
  const employeeId = await demoEmployeeId();

  await prisma.$transaction(async (tx) => {
    const activeSession = await tx.workSession.findFirst({
      where: { employeeId, endTime: null },
      select: { id: true, startTime: true },
    });

    if (activeSession) {
      const durationSeconds = Math.floor(
        (Date.now() - activeSession.startTime.getTime()) / 1000,
      );
      await tx.workSession.update({
        where: { id: activeSession.id },
        data: { endTime: new Date(), durationSeconds },
      });
    }

    await tx.workSession.create({
      data: { taskId, employeeId, startTime: new Date() },
    });

    await tx.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.IN_PROGRESS },
    });
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/employee");
}

export async function endSession(taskId: number) {
  const activeSession = await prisma.workSession.findFirst({
    where: { taskId, employeeId: await demoEmployeeId(), endTime: null },
    select: { id: true, startTime: true },
  });

  if (!activeSession) return;

  const durationSeconds = Math.floor(
    (Date.now() - activeSession.startTime.getTime()) / 1000,
  );

  await prisma.workSession.update({
    where: { id: activeSession.id },
    data: { endTime: new Date(), durationSeconds },
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/employee");
}

export async function addProgress(taskId: number, formData: FormData) {
  const content = field(formData, "content");
  if (!content) return;

  await prisma.progressNote.create({
    data: {
      taskId,
      authorId: await demoEmployeeId(),
      content,
    },
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { progressNotes: { orderBy: { createdAt: "desc" } } },
  });

  if (task) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        aiSummary: mockAiSummary(
          task.title,
          task.progressNotes.map((note) => note.content),
        ),
      },
    });
  }

  revalidatePath(`/tasks/${taskId}`);
}

export async function addProof(taskId: number, formData: FormData) {
  const label = field(formData, "label");
  const url = field(formData, "url");
  if (!label || !url) return;

  await prisma.proofItem.create({
    data: {
      taskId,
      authorId: await demoEmployeeId(),
      label,
      url,
    },
  });

  revalidatePath(`/tasks/${taskId}`);
}

export async function submitForReview(taskId: number) {
  await endSession(taskId);

  await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.SUBMITTED, submittedAt: new Date() },
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/review`);
  redirect(`/tasks/${taskId}/report`);
}

export async function approveTask(taskId: number, formData: FormData) {
  const recommendation = field(formData, "recommendation");
  const managerId = await demoManagerId();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.APPROVED,
        recommendation,
        reviewedAt: new Date(),
      },
    });

    if (recommendation) {
      await tx.recommendation.create({
        data: {
          taskId,
          managerId,
          decision: TaskStatus.APPROVED,
          content: recommendation,
        },
      });
    }
  });

  revalidatePath("/manager");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/review`);
  redirect(`/tasks/${taskId}/report`);
}

export async function requestChanges(taskId: number, formData: FormData) {
  const recommendation = field(formData, "recommendation");
  const managerId = await demoManagerId();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CHANGES_REQUESTED,
        recommendation,
        reviewedAt: new Date(),
      },
    });

    if (recommendation) {
      await tx.recommendation.create({
        data: {
          taskId,
          managerId,
          decision: TaskStatus.CHANGES_REQUESTED,
          content: recommendation,
        },
      });
    }
  });

  revalidatePath("/manager");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/review`);
}
