import request from 'supertest';
import app from '../src/app.js';

export const http = () => request(app);

let counter = 0;

export interface TestUser {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(): Promise<TestUser> {
  counter += 1;
  const email = `user${Date.now()}_${counter}@onyx.test`;
  const password = 'test-Passw0rd-123!';
  const res = await http()
    .post('/api/auth/register')
    .send({ email, password, timezone: 'UTC' });
  if (res.status !== 201)
    throw new Error(`register failed ${res.status} ${JSON.stringify(res.body)}`);
  return {
    email,
    password,
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

/** A second session ("device") for an existing user. */
export async function loginUser(u: TestUser): Promise<TestUser> {
  const res = await http()
    .post('/api/auth/login')
    .send({ email: u.email, password: u.password });
  if (res.status !== 200)
    throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return {
    email: u.email,
    password: u.password,
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

export const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });
