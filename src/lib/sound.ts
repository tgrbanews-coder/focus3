let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext;
  if (!Ctx) return null;
  audio ??= new Ctx();
  return audio;
}

export function primeAudio(): void {
  const ctx = context();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export async function chime(): Promise<void> {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, index) => {
    const start = ctx.currentTime + index * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.48);
  });
}
