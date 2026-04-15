import { apiAuth } from "./axiosInstance";

// CountriesInDB en el modelo Python solo tiene codpais y name.
// iso2 NO existe como columna — quitarlo para no confundir.
// Los mappings ISO2 ↔ codpais están hardcodeados en clients.service.ts.
interface CountryResponse      { codpais: string; name: string; }
interface DocumentTypeResponse { coddoc: string;  name: string; }
interface RelationshipResponse { codrelation: string; name: string; }

const cache: {
  countries?:     CountryResponse[];
  documentTypes?: DocumentTypeResponse[];
  relationships?: RelationshipResponse[];
} = {};

export async function getCountries(): Promise<CountryResponse[]> {
  if (cache.countries) return cache.countries;
  const { data } = await apiAuth.get<CountryResponse[]>("/countries");
  // No cachear arrays vacíos — probable error de red, no datos reales.
  const result = Array.isArray(data) ? data : [];
  if (result.length > 0) cache.countries = result;
  return result;
}

export async function getDocumentTypes(): Promise<DocumentTypeResponse[]> {
  if (cache.documentTypes) return cache.documentTypes;
  const { data } = await apiAuth.get<DocumentTypeResponse[]>("/documents_type");
  const result = Array.isArray(data) ? data : [];
  if (result.length > 0) cache.documentTypes = result;
  return result;
}

export async function getRelationships(): Promise<RelationshipResponse[]> {
  if (cache.relationships) return cache.relationships;
  const { data } = await apiAuth.get<RelationshipResponse[]>("/relationships");
  const result = Array.isArray(data) ? data : [];
  if (result.length > 0) cache.relationships = result;
  return result;
}

export function clearCatalogsCache(): void {
  delete cache.countries;
  delete cache.documentTypes;
  delete cache.relationships;
}