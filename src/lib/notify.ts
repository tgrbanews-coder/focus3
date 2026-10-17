export function canNotify(): boolean {
  return typeof Notification !== "undefined";
}

export async function requestNotifications(): Promise<"granted" | "denied" | "unsupported"> {
  if (!canNotify()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export function notify(title: string, body: string): void {
  if (!canNotify() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, lang: "ar" });
  } catch {
    /* The browser can reject a notification without a user gesture. */
  }
}
