import { io } from 'socket.io-client';
export const API_BASE = import.meta.env.VITE_API_URL || '/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;
export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(data.errors)
      ? data.errors
          .map(
            (e) =>
              `${Array.isArray(e.path) ? e.path.join(' › ') : e.path || 'Input'}: ${e.message}`,
          )
          .join('\n')
      : '';
    const error = new Error(
      details ||
        (typeof data.error === 'string'
          ? data.error
          : data.message || data.error?.message || `Request failed (${response.status})`),
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
export const socket = io(SOCKET_URL, { autoConnect: false, withCredentials: true });
export const idOf = (value) => (typeof value === 'object' ? value?._id || value?.id : value);
export const date = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not started';
export const human = (value) =>
  String(value || 'Pending')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const isLive = (status) => ['RUNNING', 'ACTIVE', 'LIVE', 'IN_PROGRESS'].includes(status);
export const isOver = (status) => ['ENDED', 'FINISHED', 'COMPLETED', 'CANCELLED'].includes(status);
