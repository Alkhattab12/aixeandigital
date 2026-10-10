/** Structured developer logs. Never returned to API clients. */
export function logEvent(event: Record<string, unknown>): void {
  if (process.env.XEAN_LOG === "off") return;
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));
  } catch { /* never throw from logging */ }
}
