// Thin local-only API client for seeding flow data before the UI is touched.
import { API_URL, assertLocalApi } from "../scripts/env.mjs";
import { e2eNow } from "./clock";

const BASE = assertLocalApi(API_URL);

export interface Session {
  email: string;
  password: string;
  token: string;
}

let n = 0;

async function call<T = unknown>(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  const json = text ? JSON.parse(text) : {};
  return (json.data ?? json) as T;
}

/** Fresh user per flow so flows never see each other's data. */
export async function newUser(tag: string): Promise<Session> {
  n += 1;
  const email = `flow-${tag}-${Date.now()}-${n}@onyx.test`;
  const password = "e2e-flow-Passw0rd!";
  const data = await call<{ accessToken: string }>("POST", "/auth/register", undefined, {
    email,
    password,
    username: "Flow",
    weight: 80,
    age: 30,
  });
  return { email, password, token: data.accessToken };
}

export const api = {
  get: <T = unknown>(s: Session, p: string) => call<T>("GET", p, s.token),
  post: <T = unknown>(s: Session, p: string, b?: unknown) =>
    call<T>("POST", p, s.token, b),
  put: <T = unknown>(s: Session, p: string, b?: unknown) => call<T>("PUT", p, s.token, b),
  patch: <T = unknown>(s: Session, p: string, b?: unknown) =>
    call<T>("PATCH", p, s.token, b),
  del: <T = unknown>(s: Session, p: string) => call<T>("DELETE", p, s.token),
};

export function localDateKey(d = e2eNow()): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
