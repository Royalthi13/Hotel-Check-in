import { api } from "./axiosInstance";
 
export interface CityResult {
  code:       string;
  name:       string;
  province:   string;
  postalCode: string;
}
 
function toCityResult(c: Record<string, unknown>): CityResult {
  return {
    code:       String(c.code        ?? ""),
    name:       String(c.name        ?? ""),
    province:   String(c.province    ?? ""),
    postalCode: String(c.postal_code ?? ""),
  };
}
 
const searchCache = new Map<string, CityResult[]>();
 
export async function searchCitiesByName(name: string): Promise<CityResult[]> {
  const key = name.toLowerCase().trim();
  if (!key || key.length < 2) return [];
  if (searchCache.has(key)) return searchCache.get(key)!;
 
  const { data } = await api.get<Record<string, unknown>[]>(
    `/cities/name/${encodeURIComponent(key)}`
  );
 
  const results = (Array.isArray(data) ? data : [])
    .slice(0, 10)
    .map(toCityResult);
 
  searchCache.set(key, results);
  return results;
}
 
export async function getCityByCode(code: string): Promise<CityResult | null> {
  if (!code.trim()) return null;
 
  const { data } = await api.get<
    Record<string, unknown> | Record<string, unknown>[]
  >(`/cities/${encodeURIComponent(code.trim())}`);
 
  if (!data) return null;
  const city = Array.isArray(data) ? data[0] : data;
  if (!city) return null;
  return toCityResult(city);
}