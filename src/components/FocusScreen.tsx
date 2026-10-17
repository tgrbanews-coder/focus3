"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { tasksForDay } from "@/lib/domain";
import { formatClock, formatInt } from "@/lib/format";
import { remainingMs } from "@/lib/domain";
import { primeAudio } from "@/lib/sound";
import { useStore } from "@/components/store";

const RADIUS = 46;
const CIRC = 2 * Math.PI * RADIUS;

export function FocusScreen() {
  const router = useRouter();
  const {
    ready,
    db,
    today,
    beginTimer,
    pauseTimer,
    endTimer,
    startBreak,
    dismissBreak,
    dismissNotice,
    addDistraction,
    armAndOpen,
    tick,
  } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!db?.timer || db.timer.status !== "running" || db.timer.endsAt == null) return;
    if (now >= db.timer.endsAt) tick();
  }, [db, now, tick]);

  useEffect(() => {
    return () => {
      document.title = "Focus 3";
    };
  }, []);

  useEffect(() => {
    if (!db?.timer) {
      document.title = "تركيز — Focus 3";
      return;
    }
    const task = db.tasks.find((item) => item.id === db.timer?.taskId);
    const clock =
      db.timer.status === "running"
        ? formatClock(Math.min(db.timer.plannedMs, remainingMs(db.timer, now)))
        : "متوقف";
    document.title = `${clock} — ${task?.title ?? "تركيز"}`;
  }, [db, now]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code !== "Space" || !db?.timer) return;
      event.preventDefault();
      if (db.timer.status === "running") pauseTimer();
      else {
        primeAudio();
        beginTimer();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [db, beginTimer, pauseTimer]);

  if (!ready || !db || !today) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-2xl font-bold">جاري فتح التركيز…</p>
      </div>
    );
  }

  function leave() {
    if (db?.timer?.status === "idle") endTimer();
    router.push("/");
  }

  function saveNote() {
    const text = note.trim();
    if (!text) return;
    addDistraction(text, today!, db?.timer?.taskId ?? null);
    setNote("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  if (db.breakOffer) {
    return (
      <Stage>
        <button type="button" className="btn btn-quiet" onClick={leave}>
          اللوحة
        </button>
        <div className="mx-auto mt-16 max-w-lg text-center">
          <p className="text-sm text-muted">جلسة التركيز خلصت</p>
          <h1 className="mt-3 text-4xl font-bold">{db.breakOffer.title}</h1>
          <p className="mt-4 text-lg text-muted">خد استراحة {formatInt(db.settings.breakMinutes)} دقايق، وبعدين كمّل.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-primary" onClick={() => { primeAudio(); startBreak(); }}>
              ابدأ الاستراحة
            </button>
            <button type="button" className="btn btn-ghost" onClick={dismissBreak}>
              تخطي
            </button>
          </div>
        </div>
      </Stage>
    );
  }

  if (!db.timer && db.notice?.kind === "break-done") {
    return (
      <Stage>
        <div className="mx-auto mt-24 max-w-lg text-center" role="status">
          <h1 className="text-4xl font-bold">الاستراحة خلصت</h1>
          <p className="mt-4 text-muted">تقدر ترجع للمهمة دلوقتي.</p>
          <button
            type="button"
            className="btn btn-primary mt-8"
            onClick={() => {
              dismissNotice();
              router.push("/");
            }}
          >
            رجوع للمهام
          </button>
        </div>
      </Stage>
    );
  }

  if (!db.timer) {
    const tasks = tasksForDay(db, today);
    return (
      <Stage>
        <button type="button" className="btn btn-quiet" onClick={() => router.push("/")}>
          اللوحة
        </button>
        <div className="mx-auto mt-16 max-w-lg">
          <h1 className="text-3xl font-bold">اختَر مهمة وابدأ</h1>
          {tasks.length === 0 ? <p className="mt-4 text-muted">ارجع للوحة واكتب أهم ٣ مهام الأول.</p> : null}
          <ul className="mt-6 space-y-3">
            {tasks.map((task) => (
              <li key={task.id}>
                <button type="button" className="btn btn-ghost w-full justify-between" onClick={() => armAndOpen(task.id)}>
                  <span className="truncate">{task.title}</span>
                  <span>ابدأ التركيز</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Stage>
    );
  }

  const timer = db.timer;
  const task = db.tasks.find((item) => item.id === timer.taskId);
  const planned = timer.status === "idle" && timer.phase === "focus" ? db.settings.focusMinutes * 60_000 : timer.plannedMs;
  const left = Math.min(planned, timer.status === "idle" ? planned : remainingMs(timer, now));
  const progress = planned === 0 ? 0 : Math.min(1, Math.max(0, 1 - left / planned));
  const recent = db.distractions.filter((item) => item.taskId === timer.taskId).slice(-3).reverse();

  return (
    <Stage>
      <div className="flex items-center justify-between">
        <button type="button" className="btn btn-quiet" onClick={leave}>
          اللوحة
        </button>
        <p className="text-sm text-muted">{timer.status === "running" ? "المؤقت شغال" : timer.status === "paused" ? "متوقف" : "لسه ما بدأش"}</p>
      </div>

      <div className="mx-auto mt-10 flex max-w-xl flex-col items-center text-center">
        <p className="text-sm text-muted">{timer.phase === "break" ? "استراحة" : "المهمة الحالية"}</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{timer.phase === "break" ? "استراحة قصيرة" : task?.title ?? "تركيز"}</h1>
        <div className="relative mt-10 grid place-items-center" role="timer" aria-label="مؤقت التركيز">
          <svg viewBox="0 0 120 120" className="size-[min(78vw,18rem)] -rotate-90">
            <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="#d4652f"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.2s linear" }}
            />
          </svg>
          <p className="absolute text-5xl font-bold tracking-tight sm:text-6xl">{formatClock(left)}</p>
        </div>
        <p className="mt-4 text-sm text-muted">مسافة للإيقاف والاستكمال</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {timer.status === "running" ? (
            <button type="button" className="btn btn-primary" onClick={pauseTimer}>
              <Pause size={16} aria-hidden />
              إيقاف مؤقت
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                primeAudio();
                beginTimer();
              }}
            >
              <Play size={16} aria-hidden />
              {timer.status === "paused" ? "استكمال" : "ابدأ"}
            </button>
          )}
          {confirmEnd ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  endTimer();
                  setConfirmEnd(false);
                }}
              >
                أيوه، أنهِ الجلسة
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmEnd(false)}>
                رجوع
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (timer.phase === "focus" && timer.status !== "idle") setConfirmEnd(true);
                else endTimer();
              }}
            >
              {timer.phase === "break" ? "إنهاء الاستراحة" : "إنهاء الجلسة"}
            </button>
          )}
        </div>
        {confirmEnd ? <p className="mt-3 text-sm text-muted">الجلسة دي مش هتتحسب جلسة مكتملة.</p> : null}
      </div>

      <div className="mx-auto mt-12 w-full max-w-md">
        <button type="button" className="btn btn-quiet" aria-expanded={noteOpen} onClick={() => setNoteOpen((open) => !open)}>
          افتكرت حاجة؟
        </button>
        {noteOpen ? (
          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveNote();
            }}
          >
            <label className="sr-only" htmlFor="distraction">
              فكرة سريعة
            </label>
            <input
              id="distraction"
              className="field"
              value={note}
              maxLength={280}
              placeholder="اكتبها وخلاص…"
              onChange={(event) => setNote(event.target.value)}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (next instanceof HTMLElement && next.dataset.saveNote === "true") return;
                saveNote();
              }}
            />
            <button type="submit" data-save-note="true" className="btn btn-ghost mt-2" onMouseDown={(event) => event.preventDefault()}>
              سجّل
            </button>
            {saved ? <p className="mt-2 text-sm text-moss">اتسجلت.</p> : null}
            {recent.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {recent.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </ul>
            ) : null}
          </form>
        ) : null}
      </div>
    </Stage>
  );
}

function Stage({ children }: { children: ReactNode }) {
  return <main className="focus-stage min-h-dvh px-4 py-5 sm:px-8">{children}</main>;
}
