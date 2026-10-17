export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

export function monthMatrix(
  year: number,
  monthIndex: number,
): { dayKey: string; inMonth: boolean }[][] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 1) % 7;
  const start = new Date(year, monthIndex, 1 - startOffset);
  const weeks: { dayKey: string; inMonth: boolean }[][] = [];

  for (let w = 0; w < 6; w += 1) {
    const week: { dayKey: string; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      week.push({
        dayKey: dayKey(date),
        inMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
      });
    }
    if (week.some((cell) => cell.inMonth)) weeks.push(week);
  }

  return weeks;
}
