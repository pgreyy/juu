const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "31 DEC 26" */
export function seriesName(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}
/** "31 DEC" */
export const seriesShort = (iso: string) => seriesName(iso).slice(0, 6);

export function daysLeft(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d <= 0 ? "ended" : d === 1 ? "1 day left" : `${d} days left`;
}

/** "5d 21h" until a time */
export function until(iso: string) {
  const s = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const weekday = (iso: string) => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(iso).getUTCDay()];

export const btc = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
