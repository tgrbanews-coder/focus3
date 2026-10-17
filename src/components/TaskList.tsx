"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Timer, Trash2 } from "lucide-react";
import { addDays } from "@/lib/dates";
import { ideasForDay, taskFocus, tasksForDay, waitingIdeas } from "@/lib/domain";
import { PRIORITY_LABEL, STATUS_LABEL, formatDuration, formatInt, formatLongDate } from "@/lib/format";
import type { Priority, Task, TaskStatus } from "@/lib/types";
import { useStore } from "@/components/store";

const PRIORITIES: Priority[] = ["high", "medium", "low"];

export function TodayBoard() {
  const { db, today } = useStore();
  if (!db || !today) return null;
  const tasks = tasksForDay(db, today);

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="today-tasks">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="today-tasks" className="text-lg font-bold">
          مهام النهاردة
        </h2>
        <p className="text-sm text-muted">{formatLongDate(today)}</p>
      </div>
      {tasks.length === 0 ? <EmptyToday /> : null}
      <ul className="space-y-3">
        {tasks.map((task, index) => (
          <TaskCard key={task.id} task={task} index={index} total={tasks.length} mode="today" />
        ))}
      </ul>
      <Composer dayKey={today} mode="today" />
    </section>
  );
}

export function OverdueList() {
  const { db, today, moveTaskToDay, deleteTask } = useStore();
  if (!db || !today) return null;
  const tasks = db.tasks
    .filter((task) => task.dayKey < today && task.status !== "done")
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.order - b.order);
  if (tasks.length === 0) return null;
  const tomorrow = addDays(today, 1);

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="overdue-tasks">
      <h2 id="overdue-tasks" className="text-lg font-bold">
        لسه مخلصتهاش
      </h2>
      <p className="mt-1 text-sm text-muted">مهام أيام فاتت. انقلها بإيدك، من غير ما تعدّي تلاتة في اليوم.</p>
      <ul className="mt-4 space-y-3">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-2xl border border-line p-3">
            <p className="font-semibold">{task.title}</p>
            <p className="mt-1 text-sm text-muted">{formatLongDate(task.dayKey)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => moveTaskToDay(task.id, today)}>
                للنهاردة
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => moveTaskToDay(task.id, tomorrow)}>
                لبكرة
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => deleteTask(task.id)}>
                حذف
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TomorrowPanel() {
  const { db, today, commitIdea, deleteIdea } = useStore();
  if (!db || !today) return null;
  const tomorrow = addDays(today, 1);
  const tasks = tasksForDay(db, tomorrow);
  const ideas = ideasForDay(db, tomorrow);
  const waiting = waitingIdeas(db, today);

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="tomorrow-plan">
      <h2 id="tomorrow-plan" className="text-lg font-bold">
        مهام بكرة
      </h2>
      <p className="mt-1 text-sm text-muted">
        اكتب أفكار، وبعدين ثبّت ٣ بس ليوم {formatLongDate(tomorrow)}.
      </p>
      <ul className="mt-4 space-y-3">
        {tasks.map((task, index) => (
          <TaskCard key={task.id} task={task} index={index} total={tasks.length} mode="tomorrow" />
        ))}
      </ul>
      {tasks.length === 0 ? <p className="mt-4 text-sm text-muted">لسه ما ثبتّش مهام بكرة.</p> : null}
      <Composer dayKey={tomorrow} mode="tomorrow" />
      {ideas.length > 0 ? (
        <ul className="mt-4 space-y-2" aria-label="أفكار بكرة">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2">
              <span>{idea.title}</span>
              <span className="flex gap-2">
                <button type="button" className="btn btn-quiet" onClick={() => commitIdea(idea.id, tomorrow)}>
                  ثبّتها
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => deleteIdea(idea.id)}>
                  حذف
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {waiting.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-bold">أفكار مستنية</h3>
          <ul className="mt-2 space-y-2">
            {waiting.map((idea) => (
              <li key={idea.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-3 py-2">
                <span>
                  {idea.title}
                  <span className="mt-1 block text-xs text-muted">{formatLongDate(idea.targetDayKey)}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-quiet" onClick={() => commitIdea(idea.id, today)}>
                    للنهاردة
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => commitIdea(idea.id, tomorrow)}>
                    لبكرة
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => deleteIdea(idea.id)}>
                    حذف
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function EmptyToday() {
  return (
    <div className="mb-4 grid justify-items-center px-4 py-8 text-center">
      <div className="grid size-16 place-items-center rounded-full border border-dashed border-ember text-xl font-bold text-ember">
        ٣
      </div>
      <p className="mt-4 max-w-xs text-muted">لسه ما كتبتش حاجة. مهمة واحدة واضحة أحسن من قائمة طويلة.</p>
    </div>
  );
}

function Composer({ dayKey, mode }: { dayKey: string; mode: "today" | "tomorrow" }) {
  const { db, addTask, addIdea } = useStore();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  if (!db) return null;
  const full = tasksForDay(db, dayKey).length >= 3;

  if (mode === "today" && full) {
    return <p className="mt-4 text-sm text-muted">التلاتة اتحددوا. امسح مهمة لو عايز تغيّر واحدة.</p>;
  }

  function submitTask() {
    if (!title.trim()) return;
    addTask(title, priority, dayKey);
    setTitle("");
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (full) return;
        submitTask();
      }}
    >
      <label className="sr-only" htmlFor={`task-${dayKey}`}>
        {mode === "today" ? "مهمة النهاردة" : "مهمة بكرة"}
      </label>
      <input
        id={`task-${dayKey}`}
        className="field"
        value={title}
        maxLength={140}
        placeholder={mode === "today" ? "اكتب مهمة واضحة…" : "فكرة لبكرة…"}
        onChange={(event) => setTitle(event.target.value)}
      />
      <PriorityPicker value={priority} onChange={setPriority} />
      <div className="flex flex-wrap gap-2">
        {full ? null : (
          <button type="submit" className="btn btn-primary">
            {mode === "today" ? "أضف للمهام" : "ثبّتها لبكرة"}
          </button>
        )}
        {mode === "tomorrow" ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (!title.trim()) return;
              addIdea(title, priority, dayKey);
              setTitle("");
            }}
          >
            احفظها كفكرة
          </button>
        ) : null}
      </div>
    </form>
  );
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (priority: Priority) => void }) {
  return (
    <div role="radiogroup" aria-label="الأولوية" className="flex flex-wrap gap-2">
      {PRIORITIES.map((priority) => (
        <button
          key={priority}
          type="button"
          role="radio"
          aria-checked={value === priority}
          className={`btn btn-quiet border ${value === priority ? "border-ember text-ink" : "border-transparent"}`}
          onClick={() => onChange(priority)}
        >
          {PRIORITY_LABEL[priority]}
        </button>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  index,
  total,
  mode,
}: {
  task: Task;
  index: number;
  total: number;
  mode: "today" | "tomorrow";
}) {
  const { db, today, updateTask, deleteTask, moveTask, moveTaskToDay, armAndOpen } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const focus = db ? taskFocus(db, task.id) : { count: 0, ms: 0 };
  const active = db?.timer?.taskId === task.id && db.timer.status !== "idle";

  if (!today) return null;

  function saveTitle() {
    const next = draft.trim();
    if (!next || next === task.title) {
      setDraft(task.title);
      setEditing(false);
      return;
    }
    updateTask(task.id, { title: next });
    setEditing(false);
  }

  return (
    <li className={`rounded-2xl border p-3 sm:p-4 ${task.status === "done" ? "border-moss/40 bg-moss/5" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-sm font-bold" aria-hidden>
          {formatInt(index + 1)}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveTitle();
              }}
            >
              <label className="sr-only" htmlFor={`edit-${task.id}`}>
                تعديل المهمة
              </label>
              <input
                id={`edit-${task.id}`}
                className="field"
                value={draft}
                maxLength={140}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onBlur={saveTitle}
              />
            </form>
          ) : (
            <p className={`text-base font-bold ${task.status === "done" ? "text-muted line-through" : ""}`}>{task.title}</p>
          )}
          <p className="mt-1 text-sm text-muted">
            {STATUS_LABEL[task.status]}
            {focus.count > 0 ? ` · ${formatInt(focus.count)} ${focus.count === 1 ? "جلسة" : "جلسات"} · ${formatDuration(focus.ms)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "today" && task.status !== "done" ? (
          <button type="button" className="btn btn-primary" onClick={() => updateTask(task.id, { status: "done" })}>
            <Check size={16} aria-hidden />
            تمّت
          </button>
        ) : null}
        {mode === "today" && task.status === "done" ? (
          <button type="button" className="btn btn-ghost" onClick={() => updateTask(task.id, { status: "todo" })}>
            تراجع
          </button>
        ) : null}
        {mode === "today" ? (
          <button type="button" className="btn btn-ghost" onClick={() => armAndOpen(task.id)}>
            <Timer size={16} aria-hidden />
            {active ? "ارجع للجلسة" : "ابدأ التركيز"}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`status-${task.id}`}>
          حالة المهمة
        </label>
        <select
          id={`status-${task.id}`}
          className="field h-10 w-auto py-0"
          value={task.status}
          onChange={(event) => updateTask(task.id, { status: event.target.value as TaskStatus })}
        >
          {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <PriorityPicker value={task.priority} onChange={(priority) => updateTask(task.id, { priority })} />
        <button
          type="button"
          className="icon-btn"
          aria-label="تعديل المهمة"
          onClick={() => {
            setDraft(task.title);
            setEditing(true);
          }}
        >
          <Pencil size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label="تقديم المهمة" disabled={index === 0} onClick={() => moveTask(task.id, -1)}>
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="تأخير المهمة"
          disabled={index === total - 1}
          onClick={() => moveTask(task.id, 1)}
        >
          <ArrowDown size={16} />
        </button>
        {mode === "today" && task.status !== "done" ? (
          <button type="button" className="btn btn-quiet" onClick={() => moveTaskToDay(task.id, addDays(today, 1))}>
            رحّل لبكرة
          </button>
        ) : null}
        {confirmDelete ? (
          <>
            <button type="button" className="btn btn-quiet text-ember" onClick={() => deleteTask(task.id)}>
              تأكيد الحذف
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
              إلغاء
            </button>
          </>
        ) : (
          <button type="button" className="icon-btn" aria-label="حذف المهمة" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </li>
  );
}
