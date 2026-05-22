from __future__ import annotations

import subprocess
import sys


def pids_on_port(port: str) -> list[str]:
    if sys.platform != "win32":
        return []

    output = subprocess.run(
        ["netstat", "-ano"],
        capture_output=True,
        check=False,
        text=True,
    ).stdout

    pids: list[str] = []
    for line in output.splitlines():
        if f":{port}" not in line or "LISTENING" not in line:
            continue
        pid = line.split()[-1]
        if pid not in pids:
            pids.append(pid)
    return pids


def stop_pid(pid: str) -> None:
    subprocess.run(
        ["taskkill", "/PID", pid, "/T", "/F"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    port = sys.argv[1] if len(sys.argv) > 1 else "8000"
    pids = pids_on_port(port)

    if not pids:
        print(f"No app is running on port {port}.")
        return

    for pid in pids:
        stop_pid(pid)
        print(f"Stopped process {pid} on port {port}.")


if __name__ == "__main__":
    main()
