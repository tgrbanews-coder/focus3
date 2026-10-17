"use client";

import { addDays } from "@/lib/dates";
import { formatLongDate } from "@/lib/format";
import { useStore } from "@/components/store";

export function InboxPanel() {
  const { db, today, deleteDistraction, distractionToIdea } = useStore();
  if (!db || !today) return null;
  const notes = [...db.distractions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="inbox-title">
      <h2 id="inbox-title" className="text-lg font-bold">
        أفكار افتكرتها
      </h2>
      <p className="mt-1 text-sm text-muted">اللي كتبته وسط التركيز، من غير ما تقطع الجلسة.</p>
      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-muted">لسه ما فيش أفكار متسجلة.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-2xl border border-line px-3 py-3">
              <p>{note.text}</p>
              <p className="mt-1 text-xs text-muted">{formatLongDate(note.dayKey)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn btn-quiet" onClick={() => distractionToIdea(note.id, addDays(today, 1))}>
                  حطها لبكرة
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => deleteDistraction(note.id)}>
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
