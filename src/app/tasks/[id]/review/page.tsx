import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { approveTask, requestChanges } from "@/app/actions";
import { EmptyState, Shell, Stat, StatusPill } from "@/app/components";
import { ensureDemoData } from "@/lib/demo-data";
import { formatDate, formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TaskReviewPage({
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
      progressNotes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      proofItems: { include: { author: true }, orderBy: { createdAt: "desc" } },
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

      <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Review: {task.title}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-zinc-600">{task.description}</p>
            <p className="mt-3 text-sm text-zinc-500">
              Employee: {task.assignee.name} · Submitted {formatDate(task.submittedAt)}
            </p>
          </div>
          <StatusPill status={task.status} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="Tracked work" value={formatDuration(trackedSeconds)} icon={CheckCircle2} />
        <Stat label="Notes" value={task.progressNotes.length} icon={CheckCircle2} />
        <Stat label="Proof items" value={task.proofItems.length} icon={CheckCircle2} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Progress notes</h2>
          <div className="mt-4 space-y-3">
            {task.progressNotes.length ? (
              task.progressNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm text-zinc-700">{note.content}</p>
                  <p className="mt-2 text-xs text-zinc-500">{formatDate(note.createdAt)}</p>
                </div>
              ))
            ) : (
              <EmptyState text="No notes submitted." />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Proof</h2>
          <div className="mt-4 space-y-3">
            {task.proofItems.length ? (
              task.proofItems.map((proof) => (
                <a key={proof.id} href={proof.url} target="_blank" className="block rounded-lg border border-zinc-200 p-3 text-sm hover:bg-stone-50">
                  <span className="font-semibold text-emerald-800">{proof.label}</span>
                  <span className="mt-1 block break-all text-zinc-500">{proof.url}</span>
                </a>
              ))
            ) : (
              <EmptyState text="No proof submitted." />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">AI summary</h2>
          <p className="mt-4 leading-7 text-zinc-600">{task.aiSummary}</p>
        </div>
      </section>

      <form className="mt-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Manager recommendation</h2>
        <textarea
          name="recommendation"
          rows={4}
          defaultValue={task.recommendation ?? ""}
          className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700"
          placeholder="Add recommendation or change request notes"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            formAction={approveTask.bind(null, task.id)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <CheckCircle2 className="size-4" />
            Approve
          </button>
          <button
            formAction={requestChanges.bind(null, task.id)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            <RotateCcw className="size-4" />
            Request changes
          </button>
        </div>
      </form>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Recommendation history</h2>
        <div className="mt-4 space-y-3">
          {task.recommendations.length ? (
            task.recommendations.map((item) => (
              <article key={item.id} className="rounded-lg border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{item.manager.name}</p>
                  <StatusPill status={item.decision} />
                </div>
                <p className="mt-3 leading-7 text-zinc-700">{item.content}</p>
                <p className="mt-3 text-sm text-zinc-500">{formatDate(item.createdAt)}</p>
              </article>
            ))
          ) : (
            <EmptyState text="No manager recommendations yet." />
          )}
        </div>
      </section>
    </Shell>
  );
}
