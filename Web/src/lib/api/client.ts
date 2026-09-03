import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL } from './config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';

/** The refresh token was revoked or expired — the user must sign in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired: refresh token rejected');
    this.name = 'SessionExpiredError';
  }
}

/**
 * Called when the backend rejects the refresh token: the session is over and
 * the app should return to the login hub. Wired once, by the auth provider.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

/**
 * Latches once the expiry notice has fired, so a burst of concurrent 401s only
 * signs the user out once. Re-armed on every fresh session.
 */
let sessionExpiredNotified = false;
export function resetSessionExpiry(): void {
  sessionExpiredNotified = false;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthCall = config?.url?.includes('/auth/') ?? false;

    if (error.response?.status === 401 && config && !isAuthCall && !config._retried) {
      try {
        await refreshTokens();
        config._retried = true;
        config.headers.set('Authorization', `Bearer ${getAccessToken()}`);
        return await api.request(config);
      } catch (refreshError) {
        if (refreshError instanceof SessionExpiredError) {
          clearTokens();
          // One expiry can surface as many simultaneous 401s — every in-flight
          // request awaits the same failed refresh. Announce it once.
          if (!sessionExpiredNotified) {
            sessionExpiredNotified = true;
            onSessionExpired?.();
          }
        }
        // Anything else is a network problem: the session is still valid, so
        // the tokens stay put and the caller surfaces the network error. A
        // dead connection must never log anyone out.
      }
    }
    return Promise.reject(error);
  },
);

let refreshing: Promise<void> | null = null;

/**
 * Trades the stored refresh token for a fresh pair. Concurrent callers share
 * one in-flight request, so a burst of 401s can't rotate the token twice.
 *
 * Throws {@link SessionExpiredError} when the backend rejects the token (the
 * user is genuinely signed out), and the underlying error when the server
 * simply couldn't be reached (the session survives).
 */
export function refreshTokens(): Promise<void> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function doRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new SessionExpiredError();

  let data: { accessToken: string; refreshToken: string } | undefined;
  try {
    // A bare axios instance: the interceptor above must not re-enter here.
    const res = await axios.post<{ data?: typeof data }>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 20000 },
    );
    data = res.data?.data;
  } catch (e) {
    const status = (e as AxiosError).response?.status;
    if (status === 401 || status === 403) throw new SessionExpiredError();
    throw e; // Network/server problem — the session is still good.
  }

  if (!data?.accessToken || !data?.refreshToken) throw new SessionExpiredError();
  saveTokens(data.accessToken, data.refreshToken);
  // The session is alive again — allow a future expiry to be announced.
  resetSessionExpiry();
}

/**
 * The backend wraps every response in `{ success, statusCode, data }`. This
 * unwraps it so callers work with the payload directly.
 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<{ data?: T } | T>(config);
  const body = res.data;
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const http = {
  get: <T>(url: string, params?: unknown) => request<T>({ method: 'GET', url, params }),
  post: <T>(url: string, data?: unknown) => request<T>({ method: 'POST', url, data }),
  patch: <T>(url: string, data?: unknown) => request<T>({ method: 'PATCH', url, data }),
  put: <T>(url: string, data?: unknown) => request<T>({ method: 'PUT', url, data }),
  delete: <T>(url: string, data?: unknown) => request<T>({ method: 'DELETE', url, data }),
};

/**
 * Pulls the human-readable message out of a failed call.
 *
 * The API returns `{ message }` (sometimes an array of validation strings), so
 * screens can show what actually went wrong instead of "Request failed".
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string | string[] } | undefined)
      ?.message;
    if (Array.isArray(message) && message.length) return message[0];
    if (typeof message === 'string' && message) return message;
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond.';
    if (!error.response) return "Couldn't reach the server. Check your connection.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** HTTP status of a failed call, or undefined when the request never landed. */
export function errorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}
