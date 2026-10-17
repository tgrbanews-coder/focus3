"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { dayKey } from "@/lib/dates";
import {
  addDistraction as addDistractionTo,
  addIdea as addIdeaTo,
  addTask as addTaskTo,
  armTimer,
  beginTimer as beginTimerIn,
  commitIdea as commitIdeaIn,
  deleteDistraction as deleteDistractionIn,
  deleteIdea as deleteIdeaIn,
  deleteTask as deleteTaskIn,
  dismissBreak as dismissBreakIn,
  dismissNotice as dismissNoticeIn,
  distractionToIdea as distractionToIdeaIn,
  endTimer as endTimerIn,
  moveTask as moveTaskIn,
  moveTaskToDay,
  pauseTimer as pauseTimerIn,
  reconcile,
  remainingMs,
  sanitizeDatabase,
  startBreak as startBreakIn,
  updateSettings as updateSettingsIn,
  updateTask as updateTaskIn,
} from "@/lib/domain";
import { formatClock, formatInt } from "@/lib/format";
import { notify, requestNotifications } from "@/lib/notify";
import { chime, primeAudio } from "@/lib/sound";
import { loadDatabase, saveDatabase } from "@/lib/storage";
import type { Database, DomainResult, Priority, Settings, Signal, TaskStatus, ThemeSetting } from "@/lib/types";

interface StoreValue {
  ready: boolean;
  db: Database | null;
  today: string | null;
  message: string | null;
  clearMessage: () => void;
  addTask: (title: string, priority: Priority, day: string) => void;
  updateTask: (id: string, patch: { title?: string; priority?: Priority; status?: TaskStatus }) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, direction: -1 | 1) => void;
  moveTaskToDay: (id: string, day: string) => void;
  addIdea: (title: string, priority: Priority, day: string) => void;
  commitIdea: (id: string, day: string) => void;
  deleteIdea: (id: string) => void;
  armAndOpen: (taskId: string) => void;
  beginTimer: () => void;
  pauseTimer: () => void;
  endTimer: () => void;
  startBreak: () => void;
  dismissBreak: () => void;
  dismissNotice: () => void;
  addDistraction: (text: string, day: string, taskId: string | null) => void;
  deleteDistraction: (id: string) => void;
  distractionToIdea: (id: string, day: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setNotifications: (enabled: boolean) => Promise<void>;
  importData: (raw: string) => void;
  tick: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

let current: Database | null = null;
const listeners = new Set<() => void>();

function publish(next: Database): string | null {
  current = next;
  const problem = saveDatabase(next);
  listeners.forEach((listener) => listener());
  return problem;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readDatabase(): Database | null {
  if (current) return current;
  const result = reconcile(loadDatabase(), Date.now());
  current = result.db;
  saveDatabase(current);
  if (result.signal) {
    const signal = result.signal;
    const settings = result.db.settings;
    queueMicrotask(() => feedback(signal, settings));
  }
  return current;
}

function subscribeClock(listener: () => void) {
  const id = window.setInterval(listener, 30_000);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", listener);
  };
}

function applyTheme(theme: ThemeSetting) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function feedback(signal: Signal, settings: Settings) {
  if (signal === "day-done") return;
  if (settings.soundEnabled) void chime();
  if (!settings.notificationsEnabled) return;
  if (signal === "focus-complete") {
    notify("خلصت جلسة التركيز", `خد استراحة ${formatInt(settings.breakMinutes)} دقايق، وبعدين كمّل.`);
  } else {
    notify("الاستراحة خلصت", "تقدر ترجع للمهمة دلوقتي.");
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const db = useSyncExternalStore(subscribe, readDatabase, () => null);
  const today = useSyncExternalStore(subscribeClock, () => dayKey(new Date()), () => null);
  const [message, setMessage] = useState<string | null>(null);

  const apply = useCallback((recipe: (database: Database) => DomainResult, onOk?: (next: Database) => void) => {
    const prev = readDatabase();
    if (!prev) return;
    const result = recipe(prev);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (result.signal) feedback(result.signal, result.db.settings);
    if (result.db !== prev) {
      const problem = publish(result.db);
      if (problem) setMessage(problem);
    }
    onOk?.(result.db);
  }, []);

  const tick = useCallback(() => {
    const prev = readDatabase();
    if (!prev?.timer || prev.timer.status !== "running" || prev.timer.endsAt == null) return;
    if (Date.now() < prev.timer.endsAt) return;
    apply((database) => reconcile(database, Date.now()));
  }, [apply]);

  useEffect(() => {
    const id = window.setInterval(tick, 250);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [tick]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 4600);
    return () => window.clearTimeout(id);
  }, [message]);

  useLayoutEffect(() => {
    if (!db) return;
    applyTheme(db.settings.theme);
  }, [db]);

  useEffect(() => {
    if (!db || db.settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [db]);

  const value = useMemo<StoreValue>(
    () => ({
      ready: db !== null && today !== null,
      db,
      today,
      message,
      clearMessage: () => setMessage(null),
      addTask: (title, priority, day) => apply((database) => addTaskTo(database, { title, priority, dayKey: day })),
      updateTask: (id, patch) => apply((database) => updateTaskIn(database, id, patch)),
      deleteTask: (id) => apply((database) => deleteTaskIn(database, id)),
      moveTask: (id, direction) => apply((database) => moveTaskIn(database, id, direction)),
      moveTaskToDay: (id, day) => apply((database) => moveTaskToDay(database, id, day)),
      addIdea: (title, priority, day) => apply((database) => addIdeaTo(database, { title, priority, targetDayKey: day })),
      commitIdea: (id, day) => apply((database) => commitIdeaIn(database, id, day)),
      deleteIdea: (id) => apply((database) => deleteIdeaIn(database, id)),
      armAndOpen: (taskId) => {
        primeAudio();
        apply(
          (database) => armTimer(database, taskId),
          () => router.push("/focus"),
        );
      },
      beginTimer: () => {
        primeAudio();
        apply((database) => beginTimerIn(database, Date.now()));
      },
      pauseTimer: () => apply((database) => pauseTimerIn(database, Date.now())),
      endTimer: () => apply((database) => endTimerIn(database, Date.now())),
      startBreak: () => {
        primeAudio();
        apply((database) => startBreakIn(database, Date.now()));
      },
      dismissBreak: () => apply((database) => dismissBreakIn(database)),
      dismissNotice: () => apply((database) => dismissNoticeIn(database)),
      addDistraction: (text, day, taskId) => apply((database) => addDistractionTo(database, { text, dayKey: day, taskId })),
      deleteDistraction: (id) => apply((database) => deleteDistractionIn(database, id)),
      distractionToIdea: (id, day) => apply((database) => distractionToIdeaIn(database, id, day)),
      updateSettings: (patch) => apply((database) => updateSettingsIn(database, patch)),
      setNotifications: async (enabled) => {
        if (!enabled) {
          apply((database) => updateSettingsIn(database, { notificationsEnabled: false }));
          return;
        }
        const permission = await requestNotifications();
        if (permission !== "granted") {
          setMessage(
            permission === "unsupported"
              ? "المتصفح ده مش بيدعم الإشعارات."
              : "المتصفح مانعش الإشعارات. تقدر تفعّلها من إعداداته.",
          );
          apply((database) => updateSettingsIn(database, { notificationsEnabled: false }));
          return;
        }
        apply((database) => updateSettingsIn(database, { notificationsEnabled: true }));
      },
      importData: (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          setMessage("الملف مش JSON.");
          return;
        }
        const clean = sanitizeDatabase(parsed);
        if (!clean) {
          setMessage("الملف مش نسخة Focus 3 صالحة.");
          return;
        }
        const prev = readDatabase();
        if (!prev) return;
        const result = reconcile({ ...clean, revision: prev.revision + 1 }, Date.now());
        if (result.signal) feedback(result.signal, result.db.settings);
        const problem = publish(result.db);
        setMessage(problem ?? "اتستوردت البيانات.");
      },
      tick,
    }),
    [db, today, message, apply, router, tick],
  );

  return (
    <StoreContext.Provider value={value}>
      <MotionConfig reducedMotion="user">
        <StoreFrame>{children}</StoreFrame>
      </MotionConfig>
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

function StoreFrame({ children }: { children: ReactNode }) {
  const { db, message, clearMessage } = useStore();
  const pathname = usePathname();
  const showTimer = Boolean(db?.timer) && pathname !== "/focus";

  return (
    <>
      <div className={showTimer ? "pb-24" : undefined}>{children}</div>
      {message ? (
        <div
          role="alert"
          className={`fixed inset-x-4 z-50 mx-auto flex max-w-md items-start justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm shadow-lg sm:inset-x-auto ${showTimer ? "bottom-24" : "bottom-4"}`}
        >
          <p>{message}</p>
          <button type="button" className="btn btn-quiet shrink-0" onClick={clearMessage}>
            إغلاق
          </button>
        </div>
      ) : null}
      {showTimer ? <ActiveTimerBar /> : null}
    </>
  );
}

function ActiveTimerBar() {
  const { db } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const running = db?.timer?.status === "running";

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  if (!db?.timer) return null;
  const task = db.tasks.find((item) => item.id === db.timer?.taskId);
  const label =
    db.timer.phase === "break"
      ? "استراحة"
      : db.timer.status === "idle"
        ? "لسه ما بدأش"
        : db.timer.status === "paused"
          ? "متوقفة"
          : formatClock(remainingMs(db.timer, now));

  return (
    <Link
      href="/focus"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-full border border-line bg-ink px-4 py-3 text-paper shadow-lg"
    >
      <span className="truncate text-sm">{task?.title ?? "جلسة تركيز"}</span>
      <span className="shrink-0 font-semibold">{label}</span>
    </Link>
  );
}
