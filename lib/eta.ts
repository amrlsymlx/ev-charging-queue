const DEFAULT_SLOT_MINUTES = 65;
const DEFAULT_BAY_COUNT = 2;

export function calculateEtaMinutes(
  position: number,
  bayCount = DEFAULT_BAY_COUNT,
  slotMinutes = DEFAULT_SLOT_MINUTES,
) {
  if (position <= 0) {
    return 0;
  }

  return Math.ceil(position / bayCount) * slotMinutes;
}

export function formatMinutes(minutes: number) {
  if (minutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

export function getRemainingMinutes(
  startedAt: string,
  plannedDurationMinutes: number,
) {
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const elapsedMins = Math.floor(elapsedMs / 60000);
  return Math.max(plannedDurationMinutes - elapsedMins, 0);
}
