import { api } from './client';

export type SupplementDbItem = {
  id: string;
  name: string;
  category: string | null;
  typicalDose: string | null;
  timingRecommendation: string | null;
  benefits: string | null;
  precautions: string | null;
};

export async function searchSupplementDb(query: string, limit = 50) {
  const params = new URLSearchParams();
  if (query) params.append('search', query);
  if (limit) params.append('limit', String(limit));
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return api.get<SupplementDbItem[]>(`/supplement-db${queryString}`);
}
