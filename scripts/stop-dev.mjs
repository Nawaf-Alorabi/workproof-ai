import { execFileSync } from "node:child_process";

const port = process.argv[2] ?? "3000";

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
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    console.log(`Stopped process ${pid} on port ${port}.`);
  } catch {
    console.log(`Process ${pid} was already stopped.`);
  }
}

const pids = pidsOnPort(port);

if (!pids.length) {
  console.log(`No dev server is listening on port ${port}.`);
  process.exit(0);
}

for (const pid of pids) {
  killPidTree(pid);
}
