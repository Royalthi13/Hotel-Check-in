import { apiAuth } from "./axiosInstance";

export interface CityResult {
  codcity: string;
  name: string;
}

const searchCache = new Map<string, CityResult[]>();

// GET /cities/name/{name}
export async function searchCitiesByName(name: string): Promise<CityResult[]> {
  const key = name.toLowerCase().trim();
  if (!key || key.length < 2) return [];
  if (searchCache.has(key)) return searchCache.get(key)!;

  const { data, status } = await apiAuth.get<CityResult[]>(
    `/cities/name/${encodeURIComponent(key)}`,
    { validateStatus: (s) => s === 200 || s === 204 },
  );

  const results = status === 204 ? [] : Array.isArray(data) ? data : [];
  searchCache.set(key, results);
  return results;
}


