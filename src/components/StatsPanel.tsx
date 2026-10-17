"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthMatrix } from "@/lib/dates";
import { computeStats } from "@/lib/domain";
import { formatDayNumber, formatGrouped, formatInt, formatLongDate, formatMonth, formatPercent, formatWeekday } from "@/lib/format";
import { useStore } from "@/components/store";

const WEEKDAYS = ["سبت", "أحد", "إثن", "ثلا", "أرب", "خمي", "جمع"];

export function StatsPanel() {
  const { db, today } = useStore();
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);
  if (!db || !today) return null;

  const stats = computeStats(db, today);
  const view = cursor ?? { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 };
  const weeks = monthMatrix(view.year, view.month);
  const chart = stats.chart.map((point) => ({
    label: formatWeekday(point.dayKey),
    minutes: point.minutes,
    full: formatLongDate(point.dayKey),
  }));
  const hasMinutes = stats.chart.some((point) => point.minutes > 0);

  function shift(amount: number) {
    const date = new Date(view.year, view.month + amount, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="stats-title">
      <h2 id="stats-title" className="text-lg font-bold">
        الإحصائيات
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="مهام مكتملة النهاردة" value={`${formatInt(stats.todayDone)} من ${formatInt(stats.todayTotal)}`} />
        <Stat label="جلسات النهاردة" value={formatInt(stats.todaySessions)} />
        <Stat label="دقائق التركيز النهاردة" value={formatInt(stats.todayMinutes)} />
        <Stat
          label="نسبة الإنجاز الأسبوعية"
          value={stats.weekRate == null ? "—" : formatPercent(stats.weekRate)}
          hint={
            stats.weekTotal === 0
              ? "لسه ما فيش مهام الأسبوع ده"
              : `${formatInt(stats.weekDone)} من ${formatInt(stats.weekTotal)} · ${stats.perfectWeekDays === 1 ? "يوم كامل" : `${formatInt(stats.perfectWeekDays)} أيام كاملة`}`
          }
        />
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold">دقائق التركيز في آخر ٧ أيام</h3>
        {hasMinutes ? null : <p className="mt-2 text-sm text-muted">لما تخلّص أول جلسة، الدقايق هتظهر هنا.</p>}
        <div className="mt-3 h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis width={28} allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--color-ember) 12%, transparent)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  color: "var(--color-ink)",
                }}
                formatter={(value) => [`${formatGrouped(Number(value ?? 0))} د`, "تركيز"]}
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as { full?: string } | undefined;
                  return row?.full ?? "";
                }}
              />
              <Bar dataKey="minutes" fill="var(--color-ember)" radius={[8, 8, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">الأيام اللي خلّصت فيها التلاتة</h3>
          <div className="flex gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => shift(-1)}>
              السابق
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => shift(1)}>
              التالي
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">{formatMonth(view.year, view.month)}</p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="mt-1 grid gap-1">
          {weeks.map((week) => (
            <div key={week[0].dayKey} className="grid grid-cols-7 gap-1">
              {week.map((cell) => {
                const perfect = db.tasks.filter((task) => task.dayKey === cell.dayKey && task.status === "done").length >= 3;
                const isToday = cell.dayKey === today;
                return (
                  <div
                    key={cell.dayKey}
                    className={`grid h-9 place-items-center rounded-full text-sm ${
                      cell.inMonth ? "" : "opacity-30"
                    } ${perfect ? "bg-moss-solid font-bold text-white" : ""} ${isToday && !perfect ? "ring-1 ring-ember" : ""}`}
                    aria-label={`${formatLongDate(cell.dayKey)}${perfect ? "، التلاتة خلصوا" : ""}`}
                  >
                    {formatDayNumber(cell.dayKey)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
