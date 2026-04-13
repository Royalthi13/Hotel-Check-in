import { apiAuth } from "./axiosInstance";

interface CountryResponse  { codpais: string; name: string; iso2: string | null; }
interface DocumentTypeResponse { coddoc: string; name: string; }
interface RelationshipResponse { codrelation: string; name: string; }

const cache: {
  countries?: CountryResponse[];
  documentTypes?: DocumentTypeResponse[];
  relationships?: RelationshipResponse[];
} = {};

export async function getCountries(): Promise<CountryResponse[]> {
  if (cache.countries) return cache.countries;
  const { data } = await apiAuth.get<CountryResponse[]>("/countries");
  cache.countries = Array.isArray(data) ? data : [];
  return cache.countries;
}

export async function getDocumentTypes(): Promise<DocumentTypeResponse[]> {
  if (cache.documentTypes) return cache.documentTypes;
  const { data } = await apiAuth.get<DocumentTypeResponse[]>("/documents_type");
  cache.documentTypes = Array.isArray(data) ? data : [];
  return cache.documentTypes;
}

export async function getRelationships(): Promise<RelationshipResponse[]> {
  if (cache.relationships) return cache.relationships;
  const { data } = await apiAuth.get<RelationshipResponse[]>("/relationships");
  cache.relationships = Array.isArray(data) ? data : [];
  return cache.relationships;
}

export function clearCatalogsCache(): void {
  delete cache.countries;
  delete cache.documentTypes;
  delete cache.relationships;
}