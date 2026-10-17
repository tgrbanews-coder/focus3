/**
 * Focus 3 document.
 *
 * Shaped so a later Supabase sync can map each array to its own table
 * (tasks, focus_sessions, distractions, ideas) plus one settings row per user.
 * Instants are ISO-8601. A "day" is a local calendar key, never a UTC date slice.
 */
export type Priority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "doing" | "done";
export type ThemeSetting = "light" | "dark" | "system";
export type SessionStatus = "completed" | "cancelled";
export type TimerPhase = "focus" | "break";
export type TimerStatus = "idle" | "running" | "paused";
export type NoticeKind = "day-done" | "break-done";
export type Signal = "focus-complete" | "break-complete" | "day-done";

export interface Task {
  id: string;
  dayKey: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface FocusSession {
  id: string;
  taskId: string;
  dayKey: string;
  plannedMs: number;
  actualMs: number;
  startedAt: string;
  endedAt: string;
  status: SessionStatus;
}

export interface Distraction {
  id: string;
  text: string;
  createdAt: string;
  dayKey: string;
  taskId: string | null;
}

export interface Idea {
  id: string;
  title: string;
  priority: Priority;
  targetDayKey: string;
  createdAt: string;
}

export interface Settings {
  theme: ThemeSetting;
  focusMinutes: number;
  breakMinutes: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface ActiveTimer {
  taskId: string;
  phase: TimerPhase;
  status: TimerStatus;
  plannedMs: number;
  elapsedMs: number;
  segmentStartedAt: number | null;
  endsAt: number | null;
  sessionStartedAt: string | null;
}

export interface BreakOffer {
  taskId: string;
  title: string;
}

export interface Notice {
  kind: NoticeKind;
  at: number;
}

export interface Database {
  schemaVersion: 1;
  revision: number;
  tasks: Task[];
  sessions: FocusSession[];
  distractions: Distraction[];
  ideas: Idea[];
  settings: Settings;
  timer: ActiveTimer | null;
  breakOffer: BreakOffer | null;
  notice: Notice | null;
}

export interface DomainResult {
  db: Database;
  error?: string;
  signal?: Signal;
}
