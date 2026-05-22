import Link from "next/link";
import { Clock, FileText, LayoutDashboard, ListTodo, UserRound } from "lucide-react";
import { formatDuration, taskStatusLabel } from "@/lib/format";

export function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "home" | "manager" | "employee";
}) {
  const nav = [
    { href: "/", label: "Demo login", key: "home", icon: UserRound },
    { href: "/manager", label: "Manager", key: "manager", icon: LayoutDashboard },
    { href: "/employee", label: "Employee", key: "employee", icon: ListTodo },
  ] as const;

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-700 text-sm font-semibold text-white">
              WP
            </div>
            <div>
              <p className="text-lg font-semibold">WorkProof AI</p>
              <p className="text-sm text-zinc-500">Onboarding and task tracking</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
                    isActive
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

export function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Clock;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{label}</p>
        <Icon className="size-4 text-emerald-700" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    TODO: "bg-zinc-100 text-zinc-700",
    IN_PROGRESS: "bg-sky-100 text-sky-800",
    SUBMITTED: "bg-amber-100 text-amber-800",
    CHANGES_REQUESTED: "bg-rose-100 text-rose-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {taskStatusLabel(status)}
    </span>
  );
}

export function DurationStat({ seconds }: { seconds: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Tracked work</p>
        <Clock className="size-4 text-emerald-700" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{formatDuration(seconds)}</p>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
      <FileText className="mx-auto mb-3 size-6 text-zinc-400" />
      {text}
    </div>
  );
}
