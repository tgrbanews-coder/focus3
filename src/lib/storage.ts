import { STORAGE_KEY, createEmptyDatabase, sanitizeDatabase } from "./domain";
import type { Database } from "./types";

/**
 * Browser persistence for the first version.
 * Swap this module for a Supabase repository later; the document shape stays the same.
 */
export function loadDatabase(): Database {
  if (typeof localStorage === "undefined") return createEmptyDatabase();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyDatabase();
  try {
    const parsed = sanitizeDatabase(JSON.parse(raw));
    if (!parsed) throw new Error("invalid focus3 document");
    return parsed;
  } catch {
    try {
      localStorage.setItem(`${STORAGE_KEY}.corrupt`, raw);
    } catch {
      /* Ignore quota errors while preserving the in-memory empty day. */
    }
    return createEmptyDatabase();
  }
}

export function saveDatabase(db: Database): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return null;
  } catch {
    return "مساحة تخزين المتصفح خلّصت. صدّر البيانات قبل ما تقفل الصفحة.";
  }
}
