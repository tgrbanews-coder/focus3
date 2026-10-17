import { addDays, dayKey, isValidDay } from "./dates";
import type {
  ActiveTimer,
  BreakOffer,
  Database,
  Distraction,
  DomainResult,
  FocusSession,
  Idea,
  Notice,
  Priority,
  Settings,
  Task,
  TaskStatus,
  ThemeSetting,
} from "@/lib/types";

export const MAX_TASKS = 3;
export const STORAGE_KEY = "focus3.v1";

const TITLE_LIMIT = 140;
const NOTE_LIMIT = 280;

export function createEmptyDatabase(): Database {
  return {
    schemaVersion: 1,
    revision: 0,
    tasks: [],
    sessions: [],
    distractions: [],
    ideas: [],
    settings: defaultSettings(),
    timer: null,
    breakOffer: null,
    notice: null,
  };
}

export function defaultSettings(): Settings {
  return {
    theme: "system",
    focusMinutes: 30,
    breakMinutes: 5,
    soundEnabled: true,
    notificationsEnabled: false,
  };
}

function uid(): string {
  return crypto.randomUUID();
}

function iso(now: number): string {
  return new Date(now).toISOString();
}

function commit(db: Database, patch: Partial<Database>, signal?: DomainResult["signal"]): DomainResult {
  return { db: { ...db, ...patch, revision: db.revision + 1 }, signal };
}

function fail(db: Database, error: string): DomainResult {
  return { db, error };
}

export function clampMinutes(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampSettings(input: Settings): Settings {
  const theme: ThemeSetting =
    input.theme === "light" || input.theme === "dark" || input.theme === "system"
      ? input.theme
      : "system";
  return {
    theme,
    focusMinutes: clampMinutes(input.focusMinutes, 1, 180, 30),
    breakMinutes: clampMinutes(input.breakMinutes, 1, 30, 5),
    soundEnabled: Boolean(input.soundEnabled),
    notificationsEnabled: Boolean(input.notificationsEnabled),
  };
}

export function tasksForDay(db: Database, day: string): Task[] {
  return db.tasks.filter((task) => task.dayKey === day).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function overdueTasks(db: Database, today: string): Task[] {
  return db.tasks
    .filter((task) => task.dayKey < today && task.status !== "done" && isValidDay(task.dayKey))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.order - b.order);
}

export function ideasForDay(db: Database, day: string): Idea[] {
  return db.ideas
    .filter((idea) => idea.targetDayKey === day)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function waitingIdeas(db: Database, today: string): Idea[] {
  return db.ideas
    .filter((idea) => idea.targetDayKey <= today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function doneCount(tasks: Task[], day: string): number {
  return tasks.filter((task) => task.dayKey === day && task.status === "done").length;
}

function withOrders(tasks: Task[]): Task[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = groups.get(task.dayKey) ?? [];
    list.push(task);
    groups.set(task.dayKey, list);
  }
  const order = new Map<string, number>();
  for (const list of groups.values()) {
    list
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
      .forEach((task, index) => order.set(task.id, index));
  }
  return tasks.map((task) => (order.get(task.id) === task.order ? task : { ...task, order: order.get(task.id) ?? task.order }));
}

function maybeCelebrate(db: Database, tasks: Task[], day: string, wasDone: number, now: number): DomainResult {
  const nowDone = doneCount(tasks, day);
  if (wasDone < MAX_TASKS && nowDone >= MAX_TASKS) {
    return commit(db, { tasks, notice: { kind: "day-done", at: now } }, "day-done");
  }
  const notice = db.notice?.kind === "day-done" && nowDone < MAX_TASKS ? null : db.notice;
  return commit(db, { tasks, notice });
}

export function addTask(
  db: Database,
  input: { title: string; priority: Priority; dayKey: string },
  now = Date.now(),
): DomainResult {
  const title = input.title.trim();
  if (!title) return fail(db, "اكتب المهمة الأول.");
  if (!isValidDay(input.dayKey)) return fail(db, "التاريخ مش صالح.");
  const existing = tasksForDay(db, input.dayKey);
  if (existing.length >= MAX_TASKS) {
    return fail(db, "تقدر تسجّل ٣ مهام بس في اليوم الواحد.");
  }
  const task: Task = {
    id: uid(),
    dayKey: input.dayKey,
    title: title.slice(0, TITLE_LIMIT),
    priority: input.priority,
    status: "todo",
    order: existing.length,
    createdAt: iso(now),
    updatedAt: iso(now),
    completedAt: null,
  };
  return commit(db, { tasks: [...db.tasks, task] });
}

export function updateTask(
  db: Database,
  id: string,
  patch: { title?: string; priority?: Priority; status?: TaskStatus },
  now = Date.now(),
): DomainResult {
  const current = db.tasks.find((task) => task.id === id);
  if (!current) return fail(db, "المهمة مش موجودة.");
  const title = patch.title === undefined ? current.title : patch.title.trim();
  if (!title) return fail(db, "اسم المهمة فاضي.");
  const status = patch.status ?? current.status;
  const tasks = db.tasks.map((task) =>
    task.id === id
      ? {
          ...task,
          title: title.slice(0, TITLE_LIMIT),
          priority: patch.priority ?? task.priority,
          status,
          completedAt: status === "done" ? task.completedAt ?? iso(now) : null,
          updatedAt: iso(now),
        }
      : task,
  );
  return maybeCelebrate(db, tasks, current.dayKey, doneCount(db.tasks, current.dayKey), now);
}

export function deleteTask(db: Database, id: string): DomainResult {
  const current = db.tasks.find((task) => task.id === id);
  if (!current) return fail(db, "المهمة مش موجودة.");
  if (db.timer && db.timer.taskId === id && db.timer.status !== "idle") {
    return fail(db, "اقفل جلسة التركيز الأول، وبعدين امسح المهمة.");
  }
  const tasks = withOrders(db.tasks.filter((task) => task.id !== id));
  const timer = db.timer?.taskId === id ? null : db.timer;
  const breakOffer = db.breakOffer?.taskId === id ? null : db.breakOffer;
  const notice = db.notice?.kind === "day-done" && doneCount(tasks, current.dayKey) < MAX_TASKS ? null : db.notice;
  return commit(db, { tasks, timer, breakOffer, notice });
}

export function moveTask(db: Database, id: string, direction: -1 | 1): DomainResult {
  const current = db.tasks.find((task) => task.id === id);
  if (!current) return fail(db, "المهمة مش موجودة.");
  const list = tasksForDay(db, current.dayKey);
  const index = list.findIndex((task) => task.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return { db };
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  const orders = new Map(next.map((task, order) => [task.id, order]));
  const tasks = db.tasks.map((task) => (orders.has(task.id) ? { ...task, order: orders.get(task.id)! } : task));
  return commit(db, { tasks });
}

export function moveTaskToDay(db: Database, id: string, day: string, now = Date.now()): DomainResult {
  const current = db.tasks.find((task) => task.id === id);
  if (!current) return fail(db, "المهمة مش موجودة.");
  if (current.status === "done") return fail(db, "المهمة مكتملة، مش محتاجة تترحّل.");
  if (!isValidDay(day)) return fail(db, "التاريخ مش صالح.");
  if (current.dayKey === day) return { db };
  if (db.timer && db.timer.taskId === id && db.timer.status !== "idle") {
    return fail(db, "اقفل جلسة التركيز الأول قبل ما ترحّل المهمة.");
  }
  if (tasksForDay(db, day).length >= MAX_TASKS) {
    return fail(db, "اليوم ده فيه ٣ مهام. فضّي مكان وبعدين رحّل.");
  }
  const tasks = withOrders(
    db.tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            dayKey: day,
            order: 100,
            status: "todo" as const,
            completedAt: null,
            updatedAt: iso(now),
          }
        : task,
    ),
  );
  const timer = db.timer?.taskId === id ? null : db.timer;
  return commit(db, { tasks, timer });
}

export function addIdea(
  db: Database,
  input: { title: string; priority: Priority; targetDayKey: string },
  now = Date.now(),
): DomainResult {
  const title = input.title.trim();
  if (!title) return fail(db, "اكتب الفكرة الأول.");
  if (!isValidDay(input.targetDayKey)) return fail(db, "التاريخ مش صالح.");
  const idea: Idea = {
    id: uid(),
    title: title.slice(0, TITLE_LIMIT),
    priority: input.priority,
    targetDayKey: input.targetDayKey,
    createdAt: iso(now),
  };
  return commit(db, { ideas: [...db.ideas, idea] });
}

export function commitIdea(db: Database, id: string, day: string, now = Date.now()): DomainResult {
  const idea = db.ideas.find((item) => item.id === id);
  if (!idea) return fail(db, "الفكرة مش موجودة.");
  if (!isValidDay(day)) return fail(db, "التاريخ مش صالح.");
  if (tasksForDay(db, day).length >= MAX_TASKS) {
    return fail(db, "اليوم ده فيه ٣ مهام. فضّي مكان الأول.");
  }
  const added = addTask(db, { title: idea.title, priority: idea.priority, dayKey: day }, now);
  if (added.error) return added;
  return commit(added.db, { ideas: added.db.ideas.filter((item) => item.id !== id) });
}

export function deleteIdea(db: Database, id: string): DomainResult {
  if (!db.ideas.some((idea) => idea.id === id)) return fail(db, "الفكرة مش موجودة.");
  return commit(db, { ideas: db.ideas.filter((idea) => idea.id !== id) });
}

export function addDistraction(
  db: Database,
  input: { text: string; dayKey: string; taskId: string | null },
  now = Date.now(),
): DomainResult {
  const text = input.text.trim();
  if (!text) return fail(db, "اكتب الفكرة عشان تتسجل.");
  if (!isValidDay(input.dayKey)) return fail(db, "التاريخ مش صالح.");
  const note: Distraction = {
    id: uid(),
    text: text.slice(0, NOTE_LIMIT),
    createdAt: iso(now),
    dayKey: input.dayKey,
    taskId: input.taskId,
  };
  return commit(db, { distractions: [...db.distractions, note] });
}

export function deleteDistraction(db: Database, id: string): DomainResult {
  if (!db.distractions.some((item) => item.id === id)) return fail(db, "الفكرة مش موجودة.");
  return commit(db, { distractions: db.distractions.filter((item) => item.id !== id) });
}

export function distractionToIdea(db: Database, id: string, targetDayKey: string, now = Date.now()): DomainResult {
  const note = db.distractions.find((item) => item.id === id);
  if (!note) return fail(db, "الفكرة مش موجودة.");
  const added = addIdea(db, { title: note.text, priority: "medium", targetDayKey }, now);
  if (added.error) return added;
  return commit(added.db, {
    distractions: added.db.distractions.filter((item) => item.id !== id),
  });
}

export function elapsedMsAt(timer: ActiveTimer, now: number): number {
  const running =
    timer.status === "running" && timer.segmentStartedAt != null
      ? timer.elapsedMs + Math.max(0, now - timer.segmentStartedAt)
      : timer.elapsedMs;
  return Math.min(timer.plannedMs, Math.max(0, running));
}

export function remainingMs(timer: ActiveTimer, now: number): number {
  if (timer.status === "running" && timer.endsAt != null) return Math.max(0, timer.endsAt - now);
  return Math.max(0, timer.plannedMs - timer.elapsedMs);
}

export function armTimer(db: Database, taskId: string): DomainResult {
  const task = db.tasks.find((item) => item.id === taskId);
  if (!task) return fail(db, "المهمة مش موجودة.");
  if (db.timer && db.timer.status !== "idle") {
    if (db.timer.taskId === taskId) return { db };
    return fail(db, "فيه جلسة شغالة. كمّلها أو اقفليها الأول.");
  }
  const timer: ActiveTimer = {
    taskId,
    phase: "focus",
    status: "idle",
    plannedMs: db.settings.focusMinutes * 60_000,
    elapsedMs: 0,
    segmentStartedAt: null,
    endsAt: null,
    sessionStartedAt: null,
  };
  return commit(db, { timer, breakOffer: null });
}

export function beginTimer(db: Database, now = Date.now()): DomainResult {
  const timer = db.timer;
  if (!timer) return fail(db, "اختَر مهمة الأول.");
  if (timer.status === "running") return { db };
  if (timer.status === "paused") return resumeTimer(db, now);
  const plannedMs = (timer.phase === "break" ? db.settings.breakMinutes : db.settings.focusMinutes) * 60_000;
  const next: ActiveTimer = {
    ...timer,
    status: "running",
    plannedMs,
    elapsedMs: 0,
    segmentStartedAt: now,
    endsAt: now + plannedMs,
    sessionStartedAt: iso(now),
  };
  const tasks = db.tasks.map((task) =>
    task.id === timer.taskId && task.status === "todo" && timer.phase === "focus"
      ? { ...task, status: "doing" as const, updatedAt: iso(now) }
      : task,
  );
  return commit(db, { timer: next, tasks });
}

export function pauseTimer(db: Database, now = Date.now()): DomainResult {
  const timer = db.timer;
  if (!timer || timer.status !== "running" || timer.segmentStartedAt == null) return { db };
  const next: ActiveTimer = {
    ...timer,
    status: "paused",
    elapsedMs: elapsedMsAt(timer, now),
    segmentStartedAt: null,
    endsAt: null,
  };
  return commit(db, { timer: next });
}

export function resumeTimer(db: Database, now = Date.now()): DomainResult {
  const timer = db.timer;
  if (!timer || timer.status !== "paused") return { db };
  const left = timer.plannedMs - timer.elapsedMs;
  if (left <= 0) return completeRunning(db, now);
  const next: ActiveTimer = {
    ...timer,
    status: "running",
    segmentStartedAt: now,
    endsAt: now + left,
  };
  return commit(db, { timer: next });
}

export function endTimer(db: Database, now = Date.now()): DomainResult {
  const timer = db.timer;
  if (!timer) return { db };
  if (timer.phase === "break" || timer.status === "idle" || !timer.sessionStartedAt) {
    return commit(db, { timer: null });
  }
  const session: FocusSession = {
    id: uid(),
    taskId: timer.taskId,
    dayKey: dayKey(new Date(timer.sessionStartedAt)),
    plannedMs: timer.plannedMs,
    actualMs: elapsedMsAt(timer, now),
    startedAt: timer.sessionStartedAt,
    endedAt: iso(now),
    status: "cancelled",
  };
  return commit(db, { timer: null, sessions: [...db.sessions, session] });
}

function completeRunning(db: Database, endedAtMs: number): DomainResult {
  const timer = db.timer;
  if (!timer) return { db };
  if (timer.phase === "break") {
    const notice: Notice = { kind: "break-done", at: endedAtMs };
    return commit(db, { timer: null, notice }, "break-complete");
  }
  const startedAt = timer.sessionStartedAt ?? iso(endedAtMs);
  const session: FocusSession = {
    id: uid(),
    taskId: timer.taskId,
    dayKey: dayKey(new Date(startedAt)),
    plannedMs: timer.plannedMs,
    actualMs: timer.plannedMs,
    startedAt,
    endedAt: iso(endedAtMs),
    status: "completed",
  };
  const task = db.tasks.find((item) => item.id === timer.taskId);
  const breakOffer: BreakOffer = {
    taskId: timer.taskId,
    title: task?.title ?? "جلسة تركيز",
  };
  return commit(db, { timer: null, sessions: [...db.sessions, session], breakOffer }, "focus-complete");
}

export function reconcile(db: Database, now = Date.now()): DomainResult {
  const timer = db.timer;
  if (!timer || timer.status !== "running" || timer.endsAt == null || now < timer.endsAt) return { db };
  return completeRunning(db, timer.endsAt);
}

export function startBreak(db: Database, now = Date.now()): DomainResult {
  if (!db.breakOffer) return fail(db, "مفيش استراحة دلوقتي.");
  if (db.timer && db.timer.status !== "idle") return fail(db, "فيه جلسة شغالة.");
  const plannedMs = db.settings.breakMinutes * 60_000;
  const timer: ActiveTimer = {
    taskId: db.breakOffer.taskId,
    phase: "break",
    status: "running",
    plannedMs,
    elapsedMs: 0,
    segmentStartedAt: now,
    endsAt: now + plannedMs,
    sessionStartedAt: iso(now),
  };
  return commit(db, { timer, breakOffer: null });
}

export function dismissBreak(db: Database): DomainResult {
  if (!db.breakOffer) return { db };
  return commit(db, { breakOffer: null });
}

export function dismissNotice(db: Database): DomainResult {
  if (!db.notice) return { db };
  return commit(db, { notice: null });
}

export function updateSettings(db: Database, patch: Partial<Settings>): DomainResult {
  return commit(db, { settings: clampSettings({ ...db.settings, ...patch }) });
}

export interface DayPoint {
  dayKey: string;
  minutes: number;
  done: number;
  total: number;
  perfect: boolean;
}

export interface Stats {
  todayDone: number;
  todayTotal: number;
  todaySessions: number;
  todayMinutes: number;
  weekRate: number | null;
  weekDone: number;
  weekTotal: number;
  perfectWeekDays: number;
  chart: DayPoint[];
  currentStreak: number;
  bestStreak: number;
  totalSessions: number;
  totalFocusMs: number;
}

function completedSessions(db: Database): FocusSession[] {
  return db.sessions.filter((session) => session.status === "completed");
}

function perfect(tasks: Task[], day: string): boolean {
  return doneCount(tasks, day) >= MAX_TASKS;
}

export function currentStreak(tasks: Task[], today: string): number {
  let streak = 0;
  let cursor = today;
  if (perfect(tasks, today)) {
    streak = 1;
    cursor = addDays(today, -1);
  } else {
    cursor = addDays(today, -1);
  }
  for (let guard = 0; guard < 4000 && perfect(tasks, cursor); guard += 1) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function bestStreak(tasks: Task[], today: string): number {
  const keys = tasks.map((task) => task.dayKey).filter(isValidDay).sort();
  if (keys.length === 0) return currentStreak(tasks, today);
  const earliest = keys[0] < addDays(today, -3650) ? addDays(today, -3650) : keys[0];
  const end = today > keys[keys.length - 1] ? today : keys[keys.length - 1];
  let best = 0;
  let run = 0;
  let cursor = earliest;
  for (let guard = 0; guard < 4000 && cursor <= end; guard += 1) {
    if (perfect(tasks, cursor)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  return Math.max(best, currentStreak(tasks, today));
}

export function computeStats(db: Database, today: string): Stats {
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
  const completed = completedSessions(db);
  const chart: DayPoint[] = days.map((key) => {
    const dayTasks = tasksForDay(db, key);
    const minutes = completed
      .filter((session) => session.dayKey === key)
      .reduce((sum, session) => sum + session.actualMs, 0);
    return {
      dayKey: key,
      minutes: Math.round(minutes / 60000),
      done: dayTasks.filter((task) => task.status === "done").length,
      total: dayTasks.length,
      perfect: perfect(db.tasks, key),
    };
  });
  const todayPoint = chart[chart.length - 1];
  const weekDone = chart.reduce((sum, point) => sum + point.done, 0);
  const weekTotal = chart.reduce((sum, point) => sum + point.total, 0);
  const todaySessions = completed.filter((session) => session.dayKey === today);
  return {
    todayDone: todayPoint?.done ?? 0,
    todayTotal: todayPoint?.total ?? 0,
    todaySessions: todaySessions.length,
    todayMinutes: todayPoint?.minutes ?? 0,
    weekRate: weekTotal === 0 ? null : weekDone / weekTotal,
    weekDone,
    weekTotal,
    perfectWeekDays: chart.filter((point) => point.perfect).length,
    chart,
    currentStreak: currentStreak(db.tasks, today),
    bestStreak: bestStreak(db.tasks, today),
    totalSessions: completed.length,
    totalFocusMs: completed.reduce((sum, session) => sum + session.actualMs, 0),
  };
}

export function taskFocus(db: Database, taskId: string): { count: number; ms: number } {
  const sessions = completedSessions(db).filter((session) => session.taskId === taskId);
  return {
    count: sessions.length,
    ms: sessions.reduce((sum, session) => sum + session.actualMs, 0),
  };
}

function isPriority(value: unknown): value is Priority {
  return value === "high" || value === "medium" || value === "low";
}

function isStatus(value: unknown): value is TaskStatus {
  return value === "todo" || value === "doing" || value === "done";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function sanitizeDatabase(input: unknown): Database | null {
  const root = asRecord(input);
  if (!root || root.schemaVersion !== 1) return null;

  const tasks: Task[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(root.tasks)) return null;
  for (const item of root.tasks) {
    const row = asRecord(item);
    if (!row) return null;
    const id = asString(row.id);
    const taskDay = asString(row.dayKey);
    const title = asString(row.title)?.trim();
    const createdAt = asString(row.createdAt);
    const updatedAt = asString(row.updatedAt);
    const order = asNumber(row.order);
    if (!id || seen.has(id) || !taskDay || !isValidDay(taskDay) || !title || !createdAt || !updatedAt || order == null) {
      return null;
    }
    if (!isPriority(row.priority) || !isStatus(row.status)) return null;
    seen.add(id);
    tasks.push({
      id,
      dayKey: taskDay,
      title: title.slice(0, TITLE_LIMIT),
      priority: row.priority,
      status: row.status,
      order,
      createdAt,
      updatedAt,
      completedAt: row.status === "done" ? asString(row.completedAt) ?? updatedAt : null,
    });
  }

  const perDay = new Map<string, number>();
  for (const task of tasks) perDay.set(task.dayKey, (perDay.get(task.dayKey) ?? 0) + 1);
  if ([...perDay.values()].some((count) => count > MAX_TASKS)) return null;

  const sessions: FocusSession[] = [];
  if (!Array.isArray(root.sessions)) return null;
  for (const item of root.sessions) {
    const row = asRecord(item);
    if (!row) return null;
    const id = asString(row.id);
    const taskId = asString(row.taskId);
    const sessionDay = asString(row.dayKey);
    const plannedMs = asNumber(row.plannedMs);
    const actualMs = asNumber(row.actualMs);
    const startedAt = asString(row.startedAt);
    const endedAt = asString(row.endedAt);
    if (!id || seen.has(id) || !taskId || !sessionDay || !isValidDay(sessionDay) || plannedMs == null || actualMs == null || !startedAt || !endedAt) {
      return null;
    }
    if (row.status !== "completed" && row.status !== "cancelled") return null;
    seen.add(id);
    sessions.push({
      id,
      taskId,
      dayKey: sessionDay,
      plannedMs: Math.max(0, plannedMs),
      actualMs: Math.max(0, actualMs),
      startedAt,
      endedAt,
      status: row.status,
    });
  }

  const distractions: Distraction[] = [];
  if (!Array.isArray(root.distractions)) return null;
  for (const item of root.distractions) {
    const row = asRecord(item);
    if (!row) return null;
    const id = asString(row.id);
    const text = asString(row.text)?.trim();
    const createdAt = asString(row.createdAt);
    const noteDay = asString(row.dayKey);
    if (!id || seen.has(id) || !text || !createdAt || !noteDay || !isValidDay(noteDay)) return null;
    seen.add(id);
    distractions.push({
      id,
      text: text.slice(0, NOTE_LIMIT),
      createdAt,
      dayKey: noteDay,
      taskId: asString(row.taskId),
    });
  }

  const ideas: Idea[] = [];
  if (!Array.isArray(root.ideas)) return null;
  for (const item of root.ideas) {
    const row = asRecord(item);
    if (!row) return null;
    const id = asString(row.id);
    const title = asString(row.title)?.trim();
    const createdAt = asString(row.createdAt);
    const targetDayKey = asString(row.targetDayKey);
    if (!id || seen.has(id) || !title || !createdAt || !targetDayKey || !isValidDay(targetDayKey) || !isPriority(row.priority)) {
      return null;
    }
    seen.add(id);
    ideas.push({
      id,
      title: title.slice(0, TITLE_LIMIT),
      priority: row.priority,
      targetDayKey,
      createdAt,
    });
  }

  const settingsRow = asRecord(root.settings);
  const settings = clampSettings({
    theme: (asString(settingsRow?.theme) as ThemeSetting) ?? "system",
    focusMinutes: asNumber(settingsRow?.focusMinutes) ?? 30,
    breakMinutes: asNumber(settingsRow?.breakMinutes) ?? 5,
    soundEnabled: settingsRow?.soundEnabled !== false,
    notificationsEnabled: settingsRow?.notificationsEnabled === true,
  });

  let timer: ActiveTimer | null = null;
  if (root.timer != null) {
    const row = asRecord(root.timer);
    if (!row) return null;
    const taskId = asString(row.taskId);
    const plannedMs = asNumber(row.plannedMs);
    const elapsedMs = asNumber(row.elapsedMs);
    if (!taskId || !tasks.some((task) => task.id === taskId) || plannedMs == null || elapsedMs == null) return null;
    if (row.phase !== "focus" && row.phase !== "break") return null;
    if (row.status !== "idle" && row.status !== "running" && row.status !== "paused") return null;
    timer = {
      taskId,
      phase: row.phase,
      status: row.status,
      plannedMs: Math.max(1000, plannedMs),
      elapsedMs: Math.max(0, elapsedMs),
      segmentStartedAt: asNumber(row.segmentStartedAt),
      endsAt: asNumber(row.endsAt),
      sessionStartedAt: asString(row.sessionStartedAt),
    };
    if (timer.status !== "running") {
      timer.segmentStartedAt = null;
      timer.endsAt = null;
    } else if (timer.endsAt == null) {
      timer.status = "paused";
      timer.segmentStartedAt = null;
    } else if (timer.segmentStartedAt == null) {
      timer.segmentStartedAt = timer.endsAt - Math.max(0, timer.plannedMs - timer.elapsedMs);
    }
  }

  let breakOffer: BreakOffer | null = null;
  if (root.breakOffer != null) {
    const row = asRecord(root.breakOffer);
    const taskId = asString(row?.taskId);
    const title = asString(row?.title)?.trim();
    if (!row || !taskId || !title) return null;
    breakOffer = { taskId, title: title.slice(0, TITLE_LIMIT) };
  }

  let notice: Notice | null = null;
  if (root.notice != null) {
    const row = asRecord(root.notice);
    const at = asNumber(row?.at);
    if (!row || (row.kind !== "day-done" && row.kind !== "break-done") || at == null) return null;
    notice = { kind: row.kind, at };
  }

  const revision = asNumber(root.revision) ?? 0;
  return {
    schemaVersion: 1,
    revision,
    tasks: withOrders(tasks),
    sessions,
    distractions,
    ideas,
    settings,
    timer,
    breakOffer,
    notice,
  };
}
