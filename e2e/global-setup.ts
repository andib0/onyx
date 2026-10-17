import { readFileSync } from 'node:fs';

// Ensures the fixture user exists on the local API (409 = already registered).
export default async function globalSetup() {
  const api = process.env.E2E_API_URL ?? 'http://localhost:3001/api';
  if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(api)) {
    throw new Error(`Refusing to provision e2e user on non-local API ${api}`);
  }
  const user = JSON.parse(readFileSync(new URL('./fixtures/test-user.json', import.meta.url), 'utf8'));
  const res = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password, username: user.name, weight: 80, age: 30 }),
  });
  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`e2e user provisioning failed: ${res.status} ${await res.text()}`);
  }
}
