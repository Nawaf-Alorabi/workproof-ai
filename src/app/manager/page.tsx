import Link from "next/link";
import { CheckCircle2, Clock, Send, UserPlus } from "lucide-react";
import { createTask } from "../actions";
import { DurationStat, EmptyState, Shell, Stat, StatusPill } from "../components";
import { formatDate, formatDuration } from "@/lib/format";
import { ensureDemoData } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  await ensureDemoData();

  const [manager, employees, tasks] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: "MANAGER" } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE" }, orderBy: { name: "asc" } }),
    prisma.task.findMany({
      include: {
        assignee: true,
        sessions: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const submitted = tasks.filter((task) => task.status === "SUBMITTED").length;
  const approved = tasks.filter((task) => task.status === "APPROVED").length;
  const totalSeconds = tasks.reduce(
    (sum, task) => sum + task.sessions.reduce((taskSum, session) => taskSum + session.durationSeconds, 0),
    0,
  );

  return (
    <Shell active="manager">
      <div className="mb-6">
        <p className="text-sm text-zinc-500">Signed in as {manager.name}</p>
        <h1 className="mt-1 text-3xl font-semibold">Manager dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Total tasks" value={tasks.length} icon={UserPlus} />
        <Stat label="Submitted" value={submitted} icon={Send} />
        <Stat label="Approved" value={approved} icon={CheckCircle2} />
        <DurationStat seconds={totalSeconds} />
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <form action={createTask} className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Create task</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Title</span>
              <input
                name="title"
                required
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-700"
                placeholder="Task title"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Description</span>
              <textarea
                name="description"
                required
                rows={5}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700"
                placeholder="Expected outcome and acceptance criteria"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Assign to</span>
              <select
                name="assigneeId"
                required
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-700"
                defaultValue={employees[0]?.id}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Due date</span>
              <input
                name="dueDate"
                type="date"
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-700"
              />
            </label>
            <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
              <UserPlus className="size-4" />
              Assign task
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-5">
            <h2 className="text-lg font-semibold">Assigned tasks</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {tasks.length ? (
              tasks.map((task) => {
                const taskSeconds = task.sessions.reduce(
                  (sum, session) => sum + session.durationSeconds,
                  0,
                );
                return (
                  <div key={task.id} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link href={`/tasks/${task.id}/review`} className="font-semibold hover:text-emerald-800">
                          {task.title}
                        </Link>
                        <p className="mt-1 text-sm text-zinc-500">
                          Assigned to {task.assignee.name} · Due {formatDate(task.dueDate)}
                        </p>
                      </div>
                      <StatusPill status={task.status} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-zinc-600">
                      <span className="inline-flex items-center gap-2">
                        <Clock className="size-4" />
                        {formatDuration(taskSeconds)}
                      </span>
                      <Link href={`/tasks/${task.id}/review`} className="font-semibold text-emerald-800">
                        Review
                      </Link>
                      <Link href={`/tasks/${task.id}/report`} className="font-semibold text-emerald-800">
                        Report
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-5">
                <EmptyState text="No tasks have been created yet." />
              </div>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
