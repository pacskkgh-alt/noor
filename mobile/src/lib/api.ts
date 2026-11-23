// الاتصال بخادم نور: نفس الحسابات والملفات الموجودة في الموقع
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// عنوان الخادم: من متغير EXPO_PUBLIC_API_URL (للتجربة المحلية) أو app.json
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'https://noor-yzbg.onrender.com';

const TOKEN_KEY = 'noor_token';
let token: string | null = null;

// رمز الجلسة يُحفظ في المخزن الآمن للجهاز (Keychain / Keystore)
export async function loadToken() {
  try {
    token = Platform.OS === 'web' ? globalThis.localStorage?.getItem(TOKEN_KEY) ?? null : await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}
export async function setToken(t: string | null) {
  token = t;
  try {
    if (Platform.OS === 'web') {
      if (t) globalThis.localStorage?.setItem(TOKEN_KEY, t);
      else globalThis.localStorage?.removeItem(TOKEN_KEY);
    } else if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}
export const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

export class ApiError extends Error {
  code: string;
  status: number;
  data: any;
  constructor(code: string, status: number, data: any) {
    super(code);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-noor-client': 'app', ...authHeaders() };
  let body = opts.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError('network', 0, {});
  }
  const newToken = res.headers.get('x-noor-token');
  if (newToken) await setToken(newToken);
  let data: any = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth')) onUnauthorized?.();
    throw new ApiError(data.error || 'server_error', res.status, data);
  }
  return data as T;
}

// رابط ملف محمي (للصور داخل التطبيق)
export const fileSource = (id: string, query = '') => ({
  uri: `${API_URL}/api/files/${id}/content${query}`,
  headers: authHeaders(),
});
