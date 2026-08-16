const DEFAULT_TIMES = {
  day: { start: "10:00", end: "21:00" },
  night: { start: "22:00", end: "08:00" },
};

// Date.UTC is used purely as a deterministic arithmetic helper here (not a real
// timezone conversion) so the comparison is immune to the server's runtime timezone.
function toMinutes(dateStr, hhmm) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, mi) / 60000;
}

function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// Google event dateTime strings look like "2026-08-20T10:00:00+03:00" — the
// digits before the offset are already the calendar's wall-clock time, the same
// convention the rest of the app uses for stored booking start/end times, so we
// slice them directly instead of parsing as a real Date (which would apply the
// offset and shift the value).
export function bestSlotForEvent(startISO, endISO) {
  const startDate = startISO.slice(0, 10);
  const startTime = startISO.slice(11, 16);
  const endDate = endISO.slice(0, 10);
  const endTime = endISO.slice(11, 16);
  const start = toMinutes(startDate, startTime);
  const end = toMinutes(endDate, endTime);

  const candidates = [addDaysStr(startDate, -1), startDate, addDaysStr(startDate, 1)];
  let best = null;
  for (const dateStr of candidates) {
    for (const slot of ["day", "night"]) {
      const defaults = DEFAULT_TIMES[slot];
      let windowStart = toMinutes(dateStr, defaults.start);
      let windowEnd = toMinutes(dateStr, defaults.end);
      if (windowEnd <= windowStart) windowEnd += 24 * 60;
      const overlap = Math.min(end, windowEnd) - Math.max(start, windowStart);
      if (overlap > 0 && (!best || overlap > best.overlap)) {
        best = { dateStr, slot, overlap };
      }
    }
  }
  if (!best) return null;
  return { slotKey: `${best.dateStr}_${best.slot}`, startDate, startTime, endDate, endTime };
}
