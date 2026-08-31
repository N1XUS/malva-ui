/**
 * Formats a duration in seconds as `m:ss` (e.g. 75 → '1:15').
 * Negative or non-finite input renders as '0:00'.
 */
export function formatChatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
