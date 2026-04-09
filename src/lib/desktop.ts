import type { DesktopPaths, DesktopSnapshot, VaultDocument } from './types';

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
