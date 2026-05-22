import { execFileSync, spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
const runner = process.platform === "win32" ? "npx.cmd" : "npx";

function pidsOnPort(targetPort) {
  if (process.platform !== "win32") return [];

  try {
    const output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    return [
      ...new Set(
        output
          .split(/\r?\n/)
          .filter((line) => line.includes(`:${targetPort}`) && line.includes("LISTENING"))
          .map((line) => line.trim().split(/\s+/).at(-1))
          .filter(Boolean),
      ),
    ];
  } catch {
    return [];
  }
}

function killPidTree(pid) {
  if (!pid) return;

  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(Number(pid), "SIGTERM");
    }
  } catch {
    // The process may already be stopped.
  }
}

for (const pid of pidsOnPort(port)) {
  killPidTree(pid);
}

const child = spawn(runner, ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: process.platform === "win32",
  windowsHide: true,
});

function shutdown(signal) {
  killPidTree(child.pid);
  process.exit(signal === "SIGINT" ? 130 : 143);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

child.on("exit", (code, signal) => {
  if (signal) shutdown(signal);
  process.exit(code ?? 0);
});
