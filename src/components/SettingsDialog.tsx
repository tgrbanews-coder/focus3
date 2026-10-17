"use client";

import { useEffect, useRef, useState } from "react";
import { dayKey } from "@/lib/dates";
import type { Database, ThemeSetting } from "@/lib/types";
import { useStore } from "@/components/store";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { db } = useStore();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!db) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {open ? <SettingsBody db={db} onClose={onClose} /> : null}
    </dialog>
  );
}

function SettingsBody({ db, onClose }: { db: Database; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { updateSettings, setNotifications, importData } = useStore();
  const [focus, setFocus] = useState(String(db.settings.focusMinutes));
  const [rest, setRest] = useState(String(db.settings.breakMinutes));
  const [confirmImport, setConfirmImport] = useState(false);

  function download() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `focus3-${dayKey(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <form
      className="space-y-5 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        updateSettings({ focusMinutes: Number(focus), breakMinutes: Number(rest) });
        onClose();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="settings-title" className="text-xl font-bold">
            الإعدادات
          </h2>
          <p className="mt-1 text-sm text-muted">البيانات متخزنة على الجهاز ده، من غير حساب.</p>
        </div>
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          إغلاق
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          مدة التركيز (دقيقة)
          <input
            className="field mt-2"
            inputMode="numeric"
            min={1}
            max={180}
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          مدة الاستراحة (دقيقة)
          <input
            className="field mt-2"
            inputMode="numeric"
            min={1}
            max={30}
            value={rest}
            onChange={(event) => setRest(event.target.value)}
          />
        </label>
      </div>
      <p className="text-sm text-muted">المدة الافتراضية للتركيز ٣٠ دقيقة، وبتتطبق على الجلسة الجاية.</p>

      <fieldset>
        <legend className="text-sm font-semibold">المظهر</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["light", "فاتح"],
              ["dark", "داكن"],
              ["system", "حسب الجهاز"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn ${db.settings.theme === value ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={db.settings.theme === value}
              onClick={() => updateSettings({ theme: value satisfies ThemeSetting })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={db.settings.soundEnabled}
          onChange={(event) => updateSettings({ soundEnabled: event.target.checked })}
        />
        صوت تنبيه لما الجلسة تخلّص
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={db.settings.notificationsEnabled}
          onChange={(event) => void setNotifications(event.target.checked)}
        />
        إشعار من المتصفح لو سمحت بيه
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={download}>
          تصدير JSON
        </button>
        {confirmImport ? (
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            اختَر الملف واستبدل البيانات
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmImport(true)}>
            استيراد JSON
          </button>
        )}
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            importData(await file.text());
            setConfirmImport(false);
            onClose();
          }}
        />
      </div>
      {confirmImport ? <p className="text-sm text-ember">الاستيراد هيستبدل مهام الجهاز ده بالنسخة اللي في الملف.</p> : null}

      <button type="submit" className="btn btn-primary">
        حفظ المدة
      </button>
    </form>
  );
}
