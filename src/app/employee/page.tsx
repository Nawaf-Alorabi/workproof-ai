import Link from "next/link";
import { ClipboardCheck, Clock, FileUp } from "lucide-react";
import { DurationStat, EmptyState, Shell, Stat, StatusPill } from "../components";
import { formatDate } from "@/lib/format";
import { ensureDemoData } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EmployeeDashboard() {
  await ensureDemoData();

  const employee = await prisma.user.findFirstOrThrow({
    where: { role: "EMPLOYEE" },
  });
  const tasks = await prisma.task.findMany({
    where: { assigneeId: employee.id },
    include: { sessions: true, progressNotes: true, proofItems: true },
    orderBy: { updatedAt: "desc" },
  });

  const totalSeconds = tasks.reduce(
    (sum, task) => sum + task.sessions.reduce((taskSum, session) => taskSum + session.durationSeconds, 0),
    0,
  );

  return (
    <Shell active="employee">
      <div className="mb-6">
        <p className="text-sm text-zinc-500">Signed in as {employee.name}</p>
        <h1 className="mt-1 text-3xl font-semibold">Employee dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Assigned tasks" value={tasks.length} icon={ClipboardCheck} />
        <Stat
          label="Progress notes"
          value={tasks.reduce((sum, task) => sum + task.progressNotes.length, 0)}
          icon={FileUp}
        />
        <Stat
          label="Proof links"
          value={tasks.reduce((sum, task) => sum + task.proofItems.length, 0)}
          icon={FileUp}
        />
        <DurationStat seconds={totalSeconds} />
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-5">
          <h2 className="text-lg font-semibold">My assigned tasks</h2>
        </div>
        <div className="divide-y divide-zinc-200">
          {tasks.length ? (
            tasks.map((task) => {
              const activeSession = task.sessions.find((session) => !session.endTime);
              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block p-5 transition hover:bg-stone-50"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 max-w-2xl text-sm text-zinc-500">{task.description}</p>
                      {task.recommendation ? (
                        <div className="mt-3 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                          <p className="font-semibold">Manager recommendation</p>
                          <p className="mt-1">{task.recommendation}</p>
                        </div>
                      ) : null}
                    </div>
                    <StatusPill status={task.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-600">
                    <span>Due {formatDate(task.dueDate)}</span>
                    <span>{task.progressNotes.length} notes</span>
                    <span>{task.proofItems.length} proofs</span>
                    {activeSession ? (
                      <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                        <Clock className="size-4" />
                        Active session
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="p-5">
              <EmptyState text="No tasks are assigned to you yet." />
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}
