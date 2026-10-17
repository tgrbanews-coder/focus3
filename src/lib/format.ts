import { parseDay } from "./dates";
import type { Priority, TaskStatus } from "./types";

const INT = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0, useGrouping: false });
const CLOCK = new Intl.NumberFormat("ar-EG", { minimumIntegerDigits: 2, useGrouping: false });
const GROUPED = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 });

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "لم تبدأ",
  doing: "جاري التنفيذ",
  done: "مكتملة",
};

export function formatInt(value: number): string {
  return INT.format(value);
}

export function formatGrouped(value: number): string {
  return GROUPED.format(value);
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${CLOCK.format(minutes)}:${CLOCK.format(seconds)}`;
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${formatGrouped(minutes)} د`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${formatGrouped(hours)} س`;
  return `${formatGrouped(hours)} س و${formatGrouped(rest)} د`;
}

export function formatLongDate(day: string): string {
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseDay(day));
}

export function formatMonth(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex, 1),
  );
}

export function formatWeekday(day: string): string {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "short" }).format(parseDay(day));
}

export function formatDayNumber(day: string): string {
  return formatInt(parseDay(day).getDate());
}
