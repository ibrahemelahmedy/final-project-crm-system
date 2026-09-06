/** Time-of-day greeting, matching the "Good afternoon, Sarah" artboard header. */
export function greeting(name: string, t: (key: string, opts: Record<string, unknown>) => string, now: Date = new Date()): string {
  const h = now.getHours();
  const key = h < 12 ? 'greeting.morning' : h < 18 ? 'greeting.afternoon' : 'greeting.evening';
  const first = name.trim().split(/\s+/)[0] || name;
  return t(key, { name: first });
}
