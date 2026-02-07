import { api, setAccessToken } from './client';

interface User {
  id: string;
  email: string;
  username?: string;
  age?: number;
  weight?: number;
  createdAt: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
}

interface MeResponse {
  user: User & {
    preferences?: {
      timezone: string;
      caffeineCutoff: string;
      sleepTarget: string;
      proteinTarget: string;
      hydrationTarget: string;
    };
  };
}

type RegisterProfile = {
  username?: string;
  age?: number;
  weight?: number;
};

export async function register(email: string, password: string, profile?: RegisterProfile) {
  const response = await api.post<AuthResponse>('/auth/register', Object.assign({ email, password }, profile || {}));

  if (response.success && response.data) {
    setAccessToken(response.data.accessToken);
  }

  return response;
}

export async function login(email: string, password: string) {
  const response = await api.post<AuthResponse>('/auth/login', { email, password });

  if (response.success && response.data) {
    setAccessToken(response.data.accessToken);
  }

  return response;
}

export async function logout() {
  const response = await api.post('/auth/logout');
  setAccessToken(null);
  return response;
}

export async function refreshToken() {
  const response = await api.post<AuthResponse>('/auth/refresh');

  if (response.success && response.data) {
    setAccessToken(response.data.accessToken);
  }

  return response;
}

export async function getMe() {
  return api.get<MeResponse>('/auth/me');
}
