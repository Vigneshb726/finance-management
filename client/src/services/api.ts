import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'finora-token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Called when the session is no longer valid — wired up by AuthProvider. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};
export const notifyUnauthorized = () => onUnauthorized?.();

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      tokenStore.clear();
      notifyUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Error raised by the offline (desktop/mobile) data layer — same status and body as the HTTP API. */
interface LocalApiError {
  name: 'ApiError';
  status: number;
  body: { message: string; errors?: { field: string; message: string }[] };
}

const isLocalApiError = (error: unknown): error is LocalApiError =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'ApiError' && 'body' in error;

/** HTTP-style status of any API error (undefined for network failures). */
export function errorStatus(error: unknown): number | undefined {
  if (isLocalApiError(error)) return error.status;
  if (axios.isAxiosError(error)) return error.response?.status;
  return undefined;
}

/** Extracts a human-readable message from any API error. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isLocalApiError(error)) return error.body.message || fallback;
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Cannot reach the server. Check your connection and that the API is running.';
    const data = error.response.data as { message?: string } | undefined;
    return data?.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/** Field-level validation errors (400 responses). */
export function getFieldErrors(error: unknown): Record<string, string> {
  const errors = isLocalApiError(error)
    ? (error.body.errors ?? [])
    : axios.isAxiosError(error)
      ? ((error.response?.data as { errors?: { field: string; message: string }[] })?.errors ?? [])
      : [];
  return Object.fromEntries(errors.map((e) => [e.field, e.message]));
}
