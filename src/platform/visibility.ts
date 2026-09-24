export const isForeground = () => typeof document === 'undefined' || !document.hidden;
export function onVisibilityChange(listener: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}
