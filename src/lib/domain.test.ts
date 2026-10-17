import assert from "node:assert/strict";
import test from "node:test";
import { addDays, dayKey } from "./dates";
import {
  addTask,
  armTimer,
  beginTimer,
  bestStreak,
  computeStats,
  createEmptyDatabase,
  currentStreak,
  endTimer,
  moveTask,
  moveTaskToDay,
  pauseTimer,
  reconcile,
  remainingMs,
  resumeTimer,
  sanitizeDatabase,
  updateTask,
} from "./domain";
import type { Task, TaskStatus } from "./types";

const DAY = "2026-10-17";

function task(day: string, status: TaskStatus, order = 0): Task {
  return {
    id: `${day}-${order}-${status}`,
    dayKey: day,
    title: "مهمة",
    priority: "medium",
    status,
    order,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
    completedAt: status === "done" ? "2026-10-17T00:00:00.000Z" : null,
  };
}

test("local day key follows the device calendar, not the UTC date", () => {
  const date = new Date(2026, 9, 17, 0, 30, 0);
  assert.equal(dayKey(date), "2026-10-17");
  if (date.getTimezoneOffset() < 0) {
    assert.notEqual(date.toISOString().slice(0, 10), "2026-10-17");
  }
});

test("a day accepts only three tasks", () => {
  let db = createEmptyDatabase();
  for (const title of ["تقرير", "مكالمة", "تمرين"]) {
    const result = addTask(db, { title, priority: "high", dayKey: DAY }, 1);
    assert.equal(result.error, undefined);
    db = result.db;
  }
  const extra = addTask(db, { title: "رابعة", priority: "low", dayKey: DAY }, 1);
  assert.match(extra.error ?? "", /٣/);
  assert.equal(extra.db.tasks.length, 3);
});

test("reorder, complete, and rollover respect the daily limit", () => {
  let db = createEmptyDatabase();
  for (const title of ["أ", "ب", "ج"]) {
    db = addTask(db, { title, priority: "medium", dayKey: DAY }, 1).db;
  }
  const first = db.tasks.find((item) => item.title === "أ")!;
  db = moveTask(db, first.id, 1).db;
  const titles = db.tasks
    .filter((item) => item.dayKey === DAY)
    .sort((a, b) => a.order - b.order)
    .map((item) => item.title);
  assert.deepEqual(titles, ["ب", "أ", "ج"]);

  const tomorrow = addDays(DAY, 1);
  for (const title of ["١", "٢", "٣"]) {
    db = addTask(db, { title, priority: "low", dayKey: tomorrow }, 1).db;
  }
  const blocked = moveTaskToDay(db, first.id, tomorrow, 2);
  assert.match(blocked.error ?? "", /٣/);
  assert.equal(blocked.db.tasks.find((item) => item.id === first.id)?.dayKey, DAY);

  db = createEmptyDatabase();
  db = addTask(db, { title: "ناقصة", priority: "high", dayKey: DAY }, 1).db;
  const id = db.tasks[0].id;
  db = moveTaskToDay(db, id, tomorrow, 2).db;
  assert.equal(db.tasks[0].dayKey, tomorrow);
  assert.equal(db.tasks.filter((item) => item.dayKey === DAY).length, 0);
});

test("streak counts finished big-three days and waits out today", () => {
  const tasks = [
    task("2026-10-14", "done", 0),
    task("2026-10-14", "done", 1),
    task("2026-10-14", "done", 2),
    task("2026-10-15", "done", 0),
    task("2026-10-15", "done", 1),
    task("2026-10-15", "done", 2),
    task("2026-10-17", "done", 0),
    task("2026-10-17", "done", 1),
    task("2026-10-17", "todo", 2),
  ];
  assert.equal(currentStreak(tasks, "2026-10-17"), 0);
  assert.equal(bestStreak(tasks, "2026-10-17"), 2);

  const finished = tasks.map((item) => ({ ...item, status: "done" as const }));
  assert.equal(currentStreak(finished, "2026-10-17"), 1);
  assert.equal(currentStreak(finished, "2026-10-16"), 2);
});

test("paused timer survives a reload and a cancelled session is not completed", () => {
  let db = createEmptyDatabase();
  db = addTask(db, { title: "قراءة", priority: "medium", dayKey: DAY }, 1).db;
  const id = db.tasks[0].id;
  const start = new Date(2026, 9, 17, 0, 30, 0).getTime();
  db = armTimer(db, id).db;
  db = beginTimer(db, start).db;
  assert.equal(db.tasks[0].status, "doing");

  const pausedAt = start + 10_000;
  db = pauseTimer(db, pausedAt).db;
  const restored = sanitizeDatabase(JSON.parse(JSON.stringify(db)));
  assert.ok(restored);
  assert.equal(remainingMs(restored.timer!, pausedAt + 60_000), 30 * 60_000 - 10_000);

  db = resumeTimer(restored, pausedAt + 60_000).db;
  assert.equal(db.timer?.endsAt, pausedAt + 60_000 + (30 * 60_000 - 10_000));

  db = endTimer(db, pausedAt + 70_000).db;
  const stats = computeStats(db, DAY);
  assert.equal(stats.totalSessions, 0);
  assert.equal(stats.todayMinutes, 0);
  assert.equal(db.sessions[0].status, "cancelled");
  assert.equal(db.sessions.filter((session) => session.status === "completed").length, 0);
});

test("a finished focus session records actual time on the local day and offers a break", () => {
  let db = createEmptyDatabase();
  db = addTask(db, { title: "كتابة", priority: "high", dayKey: DAY }, 1).db;
  const start = new Date(2026, 9, 17, 0, 30, 0).getTime();
  db = beginTimer(armTimer(db, db.tasks[0].id).db, start).db;
  const endsAt = db.timer!.endsAt!;
  const done = reconcile(db, endsAt);
  assert.equal(done.signal, "focus-complete");
  assert.equal(done.db.sessions.length, 1);
  assert.equal(done.db.sessions[0].status, "completed");
  assert.equal(done.db.sessions[0].actualMs, 30 * 60_000);
  assert.equal(done.db.sessions[0].dayKey, DAY);
  assert.equal(done.db.timer, null);
  assert.equal(done.db.breakOffer?.title, "كتابة");

  const again = reconcile(done.db, endsAt + 10_000);
  assert.equal(again.db.sessions.length, 1);
  assert.equal(computeStats(done.db, DAY).todayMinutes, 30);
  assert.equal(computeStats(done.db, DAY).totalFocusMs, 30 * 60_000);

  if (new Date(start).getTimezoneOffset() < 0) {
    assert.notEqual(new Date(start).toISOString().slice(0, 10), DAY);
  }
});

test("weekly stats only count real completed work", () => {
  let db = createEmptyDatabase();
  db = addTask(db, { title: "واحدة", priority: "low", dayKey: DAY }, 1).db;
  db = updateTask(db, db.tasks[0].id, { status: "done" }, 5).db;
  const stats = computeStats(db, DAY);
  assert.equal(stats.chart.length, 7);
  assert.equal(stats.todayDone, 1);
  assert.equal(stats.weekDone, 1);
  assert.equal(stats.weekTotal, 1);
  assert.equal(stats.weekRate, 1);
  assert.equal(stats.todaySessions, 0);
  assert.equal(stats.chart.reduce((sum, point) => sum + point.minutes, 0), 0);
});

test("import rejects a document that breaks the three-task limit", () => {
  const db = createEmptyDatabase();
  db.tasks = [0, 1, 2, 3].map((order) => task(DAY, "todo", order));
  assert.equal(sanitizeDatabase(db), null);
  assert.ok(sanitizeDatabase(createEmptyDatabase()));
});
