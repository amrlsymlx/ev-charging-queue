export type SessionPhase = "grace" | "charging" | "done";

export function getRemainingSeconds(
  startedAt: string,
  plannedDurationMinutes: number,
) {
  const elapsedSeconds = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000,
  );
  return Math.max(plannedDurationMinutes * 60 - elapsedSeconds, 0);
}

export function getSessionProgress(
  startedAt: string,
  graceMinutes: number,
  chargingMinutes: number,
): {
  phase: SessionPhase;
  remainingSeconds: number;
  totalSeconds: number;
  progress: number;
} {
  const elapsedSeconds = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000,
  );
  const graceSeconds = graceMinutes * 60;
  const chargingSeconds = chargingMinutes * 60;

  if (elapsedSeconds < graceSeconds) {
    return {
      phase: "grace",
      remainingSeconds: graceSeconds - elapsedSeconds,
      totalSeconds: graceSeconds,
      progress: graceSeconds > 0 ? elapsedSeconds / graceSeconds : 1,
    };
  }

  const chargingElapsed = elapsedSeconds - graceSeconds;
  if (chargingElapsed < chargingSeconds) {
    return {
      phase: "charging",
      remainingSeconds: chargingSeconds - chargingElapsed,
      totalSeconds: chargingSeconds,
      progress: chargingSeconds > 0 ? chargingElapsed / chargingSeconds : 1,
    };
  }

  return {
    phase: "done",
    remainingSeconds: 0,
    totalSeconds: chargingSeconds,
    progress: 1,
  };
}

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(Math.round(totalSeconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatClockTime(date: Date) {
  let hours = date.getHours();
  const mins = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}.${mins.toString().padStart(2, "0")}${ampm}`;
}

export function getSessionEndTime(
  startedAt: string,
  totalMinutes: number,
): Date {
  return new Date(new Date(startedAt).getTime() + totalMinutes * 60000);
}

// Progress toward starting to charge: elapsed wait vs. the currently
// estimated total wait (elapsed + remaining ETA). Moves toward 100% as the
// live ETA countdown shrinks.
export function getWaitProgress(joinedAt: string, etaSeconds: number) {
  const elapsedSeconds = Math.max(
    Math.floor((Date.now() - new Date(joinedAt).getTime()) / 1000),
    0,
  );
  const totalEstimate = elapsedSeconds + etaSeconds;
  return totalEstimate > 0 ? elapsedSeconds / totalEstimate : 0;
}
