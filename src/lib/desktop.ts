import type { DesktopSnapshot } from './types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function loadDesktopState(): Promise<DesktopSnapshot> {
  return invokeDesktop<DesktopSnapshot>('load_app_state');
}

export async function replaceDesktopState(snapshot: DesktopSnapshot): Promise<void> {
  await invokeDesktop('replace_app_state', { snapshot });
}
