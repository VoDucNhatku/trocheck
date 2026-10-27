'use client';

export class WorkspaceError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message); this.name = 'WorkspaceError';
  }
}
export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Không kết nối được. Vui lòng thử lại.';
}
export async function workspaceFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch('/api/workspace/' + path, {
    ...init, credentials: 'same-origin', cache: 'no-store',
    signal: init.signal ?? AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', 'X-ReNER-Request': '1', ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401 && !path.startsWith('auth/')) {
      window.location.replace('/dang-nhap?expired=1&next=' + encodeURIComponent(window.location.pathname + window.location.search));
    }
    throw new WorkspaceError(response.status, body?.error?.message ?? 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.', body?.error?.field_errors ?? {});
  }
  return response;
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await workspaceFetch(path, init);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
