import type { DesktopPaths, DesktopSecurityStatus, DesktopSnapshot, VaultDocument } from './types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

export type DesktopLogLevel = 'debug' | 'info' | 'warn' | 'error';

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    const message =
      typeof error === 'string'
        ? error
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : `Desktop command "${command}" failed`;

    throw new Error(message);
  }
}

export async function loadDesktopState(): Promise<DesktopSnapshot> {
  return invokeDesktop<DesktopSnapshot>('load_app_state');
}

export async function replaceDesktopState(snapshot: DesktopSnapshot): Promise<void> {
  await invokeDesktop('replace_app_state', { snapshot });
}

export async function getDesktopPaths(): Promise<DesktopPaths> {
  return invokeDesktop<DesktopPaths>('get_desktop_paths');
}

export type ImportVaultDocumentRequest = {
  id: string;
  name: string;
  category: VaultDocument['category'];
  fileType: string;
  size: number;
  tags: string[];
  linkedEntityId?: string;
  linkedEntityType?: VaultDocument['linkedEntityType'];
  createdAt: string;
  updatedAt: string;
  bytes: number[];
};

export async function importVaultDocument(payload: ImportVaultDocumentRequest): Promise<VaultDocument> {
  return invokeDesktop<VaultDocument>('import_vault_document', { payload });
}

export async function deleteVaultDocument(documentId: string): Promise<void> {
  await invokeDesktop('delete_vault_document', { documentId });
}

export async function readVaultDocument(documentId: string): Promise<number[]> {
  return invokeDesktop<number[]>('read_vault_document', { documentId });
}

export async function getSecurityStatus(): Promise<DesktopSecurityStatus> {
  return invokeDesktop<DesktopSecurityStatus>('get_security_status');
}

export async function recordSecurityActivity(): Promise<DesktopSecurityStatus> {
  return invokeDesktop<DesktopSecurityStatus>('record_security_activity');
}

export async function lockApp(): Promise<DesktopSecurityStatus> {
  return invokeDesktop<DesktopSecurityStatus>('lock_app');
}

export async function unlockApp(pin: string): Promise<DesktopSecurityStatus> {
  return invokeDesktop<DesktopSecurityStatus>('unlock_app', { payload: { pin } });
}

export async function setAppPin(currentPin: string | undefined, newPin: string): Promise<DesktopSecurityStatus> {
  const payload: Record<string, string> = { newPin };
  if (typeof currentPin === 'string' && currentPin.length > 0) {
    payload.currentPin = currentPin;
  }

  return invokeDesktop<DesktopSecurityStatus>('set_app_pin', {
    payload,
  });
}

export async function lockVault(): Promise<DesktopSecurityStatus> {
  return invokeDesktop<DesktopSecurityStatus>('lock_vault');
}

export async function unlockVault(password: string): Promise<DesktopSecurityStatus> {
  return invokeDesktop<DesktopSecurityStatus>('unlock_vault', { payload: { password } });
}

export async function setVaultPassword(
  currentPassword: string | undefined,
  newPassword: string,
): Promise<DesktopSecurityStatus> {
  const payload: Record<string, string> = { newPassword };
  if (typeof currentPassword === 'string' && currentPassword.length > 0) {
    payload.currentPassword = currentPassword;
  }

  return invokeDesktop<DesktopSecurityStatus>('set_vault_password', {
    payload,
  });
}

export async function setAutoLockTimeout(timeoutSeconds: number): Promise<DesktopSecurityStatus> {
  return invokeDesktop<DesktopSecurityStatus>('set_auto_lock_timeout', {
    payload: {
      timeoutSeconds,
    },
  });
}

export async function logDesktopEvent(
  level: DesktopLogLevel,
  action: string,
  details?: string,
): Promise<void> {
  await invokeDesktop('log_frontend_event', {
    level,
    action,
    details,
  });
}
