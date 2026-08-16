export const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
export const WEEKDAYS = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DEFAULT_TIMES = {
  day: { start: "10:00", end: "21:00" },
  night: { start: "22:00", end: "08:00" },
};
export function farmTimes(prices) {
  return {
    day: { start: prices?.dayStart || DEFAULT_TIMES.day.start, end: prices?.dayEnd || DEFAULT_TIMES.day.end },
    night: { start: prices?.nightStart || DEFAULT_TIMES.night.start, end: prices?.nightEnd || DEFAULT_TIMES.night.end },
  };
}

export function pad(n) { return String(n).padStart(2, "0"); }
export function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
export function fmtMoney(n) { return `${(Math.round(n * 100) / 100).toLocaleString("en-US")} د.أ`; }
export function fmtTime12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "صباحًا" : "مساءً";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}
export function fmtTime12Short(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${pad(m)}${period}`;
}
export function fmtDateShort(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${ARABIC_MONTHS[m - 1]}`;
}
export function toDateTime(dateStr, hhmm) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi);
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
export function priceForWeekday(prices, weekday, slot) {
  return prices[slot][WEEKDAY_KEYS[weekday]];
}
// هاي المزارع بتفضّل عرض سعر واحد للأحد-الأربعاء (بدل كل يوم لحاله) بكل مكان بالموقع.
const GROUPED_PRICING_FARMS = ["نخل", "هيثم"];
export function farmUsesGroupedPricing(farmName) {
  return GROUPED_PRICING_FARMS.some((m) => (farmName || "").includes(m));
}
// Extra-guest fee charged in steps: every `guestStep` people over `guestLimit` add one `guestFee`.
// guestStep defaults to 1, which reduces to a plain per-person fee (previous behavior).
export function extraGuestFeeFor(prices, guestCount) {
  const extra = Math.max(0, Number(guestCount || 0) - Number(prices.guestLimit || 0));
  const step = Number(prices.guestStep) || 1;
  return Math.ceil(extra / step) * Number(prices.guestFee || 0);
}
export function defaultPriceSet() {
  return {
    day: { sun: 100, mon: 100, tue: 100, wed: 100, thu: 130, fri: 160, sat: 130 },
    night: { sun: 150, mon: 150, tue: 150, wed: 150, thu: 180, fri: 220, sat: 180 },
    guestLimit: 15, guestFee: 5, guestStep: 1,
    dayStart: "10:00", dayEnd: "21:00", nightStart: "22:00", nightEnd: "08:00",
  };
}
export function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
