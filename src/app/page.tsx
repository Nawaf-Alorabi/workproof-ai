import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, UserCheck } from "lucide-react";
import { Shell } from "./components";
import { ensureDemoData } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureDemoData();

  const [manager, employee] = await Promise.all([
    prisma.user.findFirst({ where: { role: "MANAGER" } }),
    prisma.user.findFirst({ where: { role: "EMPLOYEE" } }),
  ]);

  return (
    <Shell active="home">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Stage 1 Prototype
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-normal text-zinc-950">
            WorkProof AI tracks assigned work from task creation to manager review.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Use the demo roles to create work, track focus sessions, add proof, submit
            for review, and generate a simple final report with a mock AI summary.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/manager"
              className="group rounded-lg border border-zinc-200 bg-stone-50 p-5 transition hover:border-emerald-700 hover:bg-white"
            >
              <BriefcaseBusiness className="size-6 text-emerald-700" />
              <p className="mt-4 font-semibold">Manager dashboard</p>
              <p className="mt-2 text-sm text-zinc-500">{manager?.email}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                Open manager view
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              href="/employee"
              className="group rounded-lg border border-zinc-200 bg-stone-50 p-5 transition hover:border-emerald-700 hover:bg-white"
            >
              <UserCheck className="size-6 text-emerald-700" />
              <p className="mt-4 font-semibold">Employee dashboard</p>
              <p className="mt-2 text-sm text-zinc-500">{employee?.email}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                Open employee view
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </div>
        <aside className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Stage 1 coverage</h2>
          <div className="mt-4 space-y-3 text-sm text-zinc-600">
            {[
              "Manager creates and assigns tasks",
              "Employee views tasks and tracks work sessions",
              "50-minute focus block break reminder",
              "Progress notes and proof links",
              "Submit, approve, request changes, and recommendations",
              "Mock AI summary and final report",
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <span className="mt-1 size-2 rounded-full bg-emerald-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </Shell>
  );
}
