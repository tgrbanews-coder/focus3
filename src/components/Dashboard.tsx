"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, Moon, Settings, Sun } from "lucide-react";
import { computeStats, tasksForDay } from "@/lib/domain";
import { formatDuration, formatInt, formatLongDate } from "@/lib/format";
import { InboxPanel } from "@/components/InboxPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StatsPanel } from "@/components/StatsPanel";
import { useStore } from "@/components/store";
import { OverdueList, TodayBoard, TomorrowPanel } from "@/components/TaskList";

export function Dashboard() {
  const { ready, db, today, updateSettings, dismissNotice, dismissBreak } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!ready || !db || !today) return <Loading />;

  const tasks = tasksForDay(db, today);
  const done = tasks.filter((task) => task.status === "done").length;
  const stats = computeStats(db, today);
  const dark = db.settings.theme === "dark" || (db.settings.theme === "system" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  return (
    <>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-full focus:bg-card focus:px-4 focus:py-2">
        تخطّي إلى المحتوى
      </a>
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#d4652f] text-lg font-bold text-white">٣</span>
            <span>
              <span className="block text-sm font-bold">Focus 3</span>
              <time dateTime={today} className="block text-xs text-muted">
                {formatLongDate(today)}
              </time>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="icon-btn"
              aria-label={dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
              onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" className="icon-btn" aria-label="الإعدادات" onClick={() => setSettingsOpen(true)}>
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main id="content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <section>
          <h1 className="max-w-3xl text-3xl font-bold leading-snug sm:text-4xl">إيه أهم ٣ حاجات لازم تنجزهم النهارده؟</h1>
          <p className="mt-3 text-muted">ركّز على التلاتة دول بس.</p>
          <p className="mt-4 text-sm font-semibold" aria-live="polite">
            {formatInt(done)} من {formatInt(3)}
          </p>
          <div className="mt-2 grid max-w-md grid-cols-3 gap-2" aria-hidden>
            {Array.from({ length: 3 }, (_, index) => {
              const task = tasks[index];
              const tone = !task ? "bg-line" : task.status === "done" ? "bg-moss-solid" : task.status === "doing" ? "bg-ember" : "bg-line";
              return <span key={index} className={`h-1.5 rounded-full ${tone}`} />;
            })}
          </div>
        </section>

        {db.breakOffer ? (
          <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3">
            <p>
              خلصت جلسة «{db.breakOffer.title}». خد استراحة {formatInt(db.settings.breakMinutes)} دقايق.
            </p>
            <span className="flex gap-2">
              <Link href="/focus" className="btn btn-primary">
                ابدأ الاستراحة
              </Link>
              <button type="button" className="btn btn-quiet" onClick={dismissBreak}>
                تخطي
              </button>
            </span>
          </div>
        ) : null}

        {db.notice?.kind === "day-done" ? (
          <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-moss-solid/30 bg-moss-solid/10 px-4 py-3">
            <p className="font-bold">خلّصت التلاتة. يوم متظبط.</p>
            <button type="button" className="btn btn-quiet" onClick={dismissNotice}>
              تمام
            </button>
          </div>
        ) : null}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_20rem]">
          <div className="space-y-6">
            <TodayBoard />
            <OverdueList />
            <TomorrowPanel />
            <InboxPanel />
          </div>
          <aside className="space-y-6">
            <section className="card p-5" aria-labelledby="streak-title">
              <h2 id="streak-title" className="flex items-center gap-2 text-lg font-bold">
                <Flame size={18} aria-hidden />
                الاستمرارية
              </h2>
              <dl className="mt-4 space-y-3">
                <Metric label="السلسلة الحالية" value={stats.currentStreak === 0 ? "لسه ما بدأتش" : `${formatInt(stats.currentStreak)} ${stats.currentStreak === 1 ? "يوم" : "أيام"}`} />
                <Metric label="أفضل سلسلة" value={`${formatInt(stats.bestStreak)} ${stats.bestStreak === 1 ? "يوم" : "أيام"}`} />
                <Metric label="جلسات التركيز" value={formatInt(stats.totalSessions)} />
                <Metric label="وقت التركيز" value={formatDuration(stats.totalFocusMs)} />
              </dl>
              <p className="mt-4 text-xs text-muted">السلسلة بتزيد لما تخلّص المهام التلاتة في اليوم.</p>
            </section>
          </aside>
        </div>

        <div className="mt-6">
          <StatsPanel />
        </div>
        <p className="mt-8 text-center text-xs text-muted">البيانات على جهازك · Focus 3</p>
      </main>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-sm text-muted">Focus 3</p>
        <p className="mt-2 text-2xl font-bold">جاري فتح يومك…</p>
      </div>
    </div>
  );
}
