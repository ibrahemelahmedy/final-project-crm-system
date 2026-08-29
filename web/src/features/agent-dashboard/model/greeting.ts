/** Time-of-day greeting, matching the "Good afternoon, Sarah" artboard header. */
export function greeting(name: string, now: Date = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const first = name.trim().split(/\s+/)[0] || name;
  return `${part}, ${first}`;
}
