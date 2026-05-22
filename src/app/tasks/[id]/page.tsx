import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileUp, Send } from "lucide-react";
import { addProgress, addProof, submitForReview } from "@/app/actions";
import { EmptyState, Shell, StatusPill } from "@/app/components";
import { WorkSessionTimer } from "@/app/timer";
import { ensureDemoData } from "@/lib/demo-data";
import { formatDate, formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
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
      sessions: { orderBy: { startTime: "desc" } },
    },
  });

  if (!task) notFound();

  const activeSession = task.sessions.find((session) => !session.endTime);
  const trackedSeconds = task.sessions
    .filter((session) => session.endTime)
    .reduce((sum, session) => sum + session.durationSeconds, 0);

  return (
    <Shell active="employee">
      <Link href="/employee" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
        <ArrowLeft className="size-4" />
        Back to employee dashboard
      </Link>

      <section className="mt-5 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{task.title}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-zinc-600">{task.description}</p>
            <p className="mt-3 text-sm text-zinc-500">
              Assigned to {task.assignee.name} · Due {formatDate(task.dueDate)}
            </p>
          </div>
          <StatusPill status={task.status} />
        </div>
      </section>

      <div className="mt-6">
        <WorkSessionTimer
          taskId={task.id}
          activeStartTime={activeSession?.startTime.toISOString()}
          trackedSeconds={trackedSeconds}
        />
      </div>

      {task.recommendation ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="text-lg font-semibold">Manager recommendation</h2>
          <p className="mt-3 leading-7">{task.recommendation}</p>
          {task.reviewedAt ? (
            <p className="mt-3 text-sm">Reviewed {formatDate(task.reviewedAt)}</p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Manager recommendation history</h2>
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

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <form action={addProgress.bind(null, task.id)} className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Add progress note</h2>
          <textarea
            name="content"
            required
            rows={5}
            className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700"
            placeholder="What did you complete or learn?"
          />
          <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
            <FileUp className="size-4" />
            Add note
          </button>
        </form>

        <form action={addProof.bind(null, task.id)} className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Add proof of work</h2>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-zinc-700">Label</span>
            <input
              name="label"
              required
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-700"
              placeholder="GitHub commit, document, screenshot"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-medium text-zinc-700">URL or file path</span>
            <input
              name="url"
              required
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-700"
              placeholder="https://..."
            />
          </label>
          <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
            <FileUp className="size-4" />
            Add proof
          </button>
        </form>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Progress notes</h2>
          <div className="mt-4 space-y-3">
            {task.progressNotes.length ? (
              task.progressNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm text-zinc-700">{note.content}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {note.author.name} · {formatDate(note.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState text="No progress notes yet." />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Proof of work</h2>
          <div className="mt-4 space-y-3">
            {task.proofItems.length ? (
              task.proofItems.map((proof) => (
                <a
                  key={proof.id}
                  href={proof.url}
                  target="_blank"
                  className="block rounded-lg border border-zinc-200 p-3 text-sm hover:bg-stone-50"
                >
                  <span className="font-semibold text-emerald-800">{proof.label}</span>
                  <span className="mt-1 block break-all text-zinc-500">{proof.url}</span>
                </a>
              ))
            ) : (
              <EmptyState text="No proof links yet." />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Work sessions</h2>
          <div className="mt-4 space-y-3">
            {task.sessions.length ? (
              task.sessions.map((session) => (
                <div key={session.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold">{session.endTime ? formatDuration(session.durationSeconds) : "Active"}</p>
                  <p className="mt-1 text-zinc-500">
                    {formatDate(session.startTime)} to {formatDate(session.endTime)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState text="No work sessions yet." />
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">AI summary</h2>
        <p className="mt-3 leading-7 text-zinc-600">{task.aiSummary}</p>
      </section>

      <form action={submitForReview.bind(null, task.id)} className="mt-6 flex flex-wrap gap-3">
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
          <Send className="size-4" />
          Submit for review
        </button>
        <Link
          href={`/tasks/${task.id}/report`}
          className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
        >
          Open report
        </Link>
      </form>
    </Shell>
  );
}
