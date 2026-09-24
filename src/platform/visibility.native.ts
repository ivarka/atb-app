import { AppState } from 'react-native';
export const isForeground = () => AppState.currentState === 'active';
export function onVisibilityChange(listener: () => void): () => void {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
}
