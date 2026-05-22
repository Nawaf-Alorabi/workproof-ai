"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Play, Square } from "lucide-react";
import { endSession, startSession } from "./actions";
import { formatDuration } from "@/lib/format";

export function WorkSessionTimer({
  taskId,
  activeStartTime,
  trackedSeconds,
}: {
  taskId: number;
  activeStartTime?: string;
  trackedSeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissedBreaks, setDismissedBreaks] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeSeconds = useMemo(() => {
    if (!activeStartTime) return 0;
    return Math.max(0, Math.floor((now - new Date(activeStartTime).getTime()) / 1000));
  }, [activeStartTime, now]);

  const totalSeconds = trackedSeconds + activeSeconds;
  const completedWorkBlocks = Math.floor(activeSeconds / (50 * 60));
  const shouldShowBreakReminder = Boolean(
    activeStartTime && completedWorkBlocks > dismissedBreaks,
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Work session timer</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {formatDuration(totalSeconds)}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={startSession.bind(null, taskId)}>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={Boolean(activeStartTime)}
            >
              <Play className="size-4" />
              Start
            </button>
          </form>
          <form action={endSession.bind(null, taskId)}>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
              disabled={!activeStartTime}
            >
              <Square className="size-4" />
              End
            </button>
          </form>
        </div>
      </div>

      {shouldShowBreakReminder ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Bell className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Take a 10-minute break</p>
              <p className="text-sm">You have completed a 50-minute focus block.</p>
            </div>
          </div>
          <button
            type="button"
            className="h-9 rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold"
            onClick={() => setDismissedBreaks(completedWorkBlocks)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
