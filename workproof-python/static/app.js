const timer = document.querySelector(".timer[data-start]");

if (timer) {
  const timerValue = document.querySelector("#timer-value");
  const start = timer.dataset.start;
  const tracked = Number(timer.dataset.tracked || "0");

  const formatDuration = (seconds) => {
    seconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const tick = () => {
    if (!start) return;
    const activeSeconds = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
    timerValue.textContent = formatDuration(tracked + activeSeconds);
  };

  tick();
  window.setInterval(tick, 1000);
}
