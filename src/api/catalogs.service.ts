import { apiAuth } from "./axiosInstance";
import type { RelacionDB } from "@/types"; // <-- Importamos tu tipo completo con linked_relation

interface CountryResponse {
  codpais: string;
  name: string;
}

interface DocumentTypeResponse {
  coddoc: string;
  name: string;
}

// Ya no necesitamos RelationshipResponse porque usaremos RelacionDB

const cache: {
  countries?: CountryResponse[];
  documentTypes?: DocumentTypeResponse[];
  relationships?: RelacionDB[]; // <-- Cambiado para usar el tipo bueno
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

// 🚀 Fusión completada: Caché + Tipo correcto en una sola función
export async function getRelationships(): Promise<RelacionDB[]> {
  if (cache.relationships) return cache.relationships;
  const { data } = await apiAuth.get<RelacionDB[]>("/relationships");
  const result = Array.isArray(data) ? data : [];
  if (result.length > 0) cache.relationships = result;
  return result;
}

export function clearCatalogsCache(): void {
  delete cache.countries;
  delete cache.documentTypes;
  delete cache.relationships;
}
