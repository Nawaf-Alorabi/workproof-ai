import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, FileText, MessageSquareText, UserRound } from "lucide-react";
import { EmptyState, Shell, Stat, StatusPill } from "@/app/components";
import { ensureDemoData } from "@/lib/demo-data";
import { formatDate, formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TaskReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureDemoData();

  const taskId = Number((await params).id);
  if (!Number.isInteger(taskId)) notFound();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: true,
      manager: true,
      progressNotes: { orderBy: { createdAt: "asc" } },
      proofItems: { orderBy: { createdAt: "asc" } },
      recommendations: { include: { manager: true }, orderBy: { createdAt: "desc" } },
      sessions: true,
    },
  });

  if (!task) notFound();

  const trackedSeconds = task.sessions.reduce((sum, session) => {
    if (!session.endTime) return sum;
    return sum + session.durationSeconds;
  }, 0);

  return (
    <Shell active="manager">
      <Link href="/manager" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
        <ArrowLeft className="size-4" />
        Back to manager dashboard
      </Link>

      <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Final report: {task.title}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-zinc-600">{task.description}</p>
          </div>
          <StatusPill status={task.status} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Stat label="Employee" value={task.assignee.name} icon={UserRound} />
          <Stat label="Manager" value={task.manager.name} icon={UserRound} />
          <Stat label="Work duration" value={formatDuration(trackedSeconds)} icon={Clock} />
          <Stat label="Reviewed" value={formatDate(task.reviewedAt)} icon={FileText} />
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-5">
            <h2 className="text-lg font-semibold">AI summary</h2>
            <p className="mt-3 leading-7 text-zinc-600">{task.aiSummary}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-5">
            <h2 className="text-lg font-semibold">Manager recommendation</h2>
            <p className="mt-3 leading-7 text-zinc-600">
              {task.recommendation || "No recommendation added yet."}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-5">
            <h2 className="text-lg font-semibold">Progress notes</h2>
            <div className="mt-4 space-y-3">
              {task.progressNotes.length ? (
                task.progressNotes.map((note) => (
                  <div key={note.id} className="rounded-lg bg-stone-50 p-3">
                    <p className="text-sm text-zinc-700">{note.content}</p>
                  </div>
                ))
              ) : (
                <EmptyState text="No progress notes." />
              )}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 p-5">
            <h2 className="text-lg font-semibold">Proof of work</h2>
            <div className="mt-4 space-y-3">
              {task.proofItems.length ? (
                task.proofItems.map((proof) => (
                  <a key={proof.id} href={proof.url} target="_blank" className="flex items-center gap-3 rounded-lg bg-stone-50 p-3 text-sm hover:bg-zinc-100">
                    <MessageSquareText className="size-4 text-emerald-700" />
                    <span className="font-semibold text-emerald-800">{proof.label}</span>
                  </a>
                ))
              ) : (
                <EmptyState text="No proof items." />
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 p-5">
          <h2 className="text-lg font-semibold">Recommendation history</h2>
          <div className="mt-4 space-y-3">
            {task.recommendations.length ? (
              task.recommendations.map((item) => (
                <article key={item.id} className="rounded-lg bg-stone-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{item.manager.name}</p>
                    <StatusPill status={item.decision} />
                  </div>
                  <p className="mt-3 leading-7 text-zinc-700">{item.content}</p>
                  <p className="mt-3 text-sm text-zinc-500">{formatDate(item.createdAt)}</p>
                </article>
              ))
            ) : (
              <EmptyState text="No recommendation history." />
            )}
          </div>
        </section>
      </section>
    </Shell>
  );
}
