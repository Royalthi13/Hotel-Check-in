import { apiAuth } from "./axiosInstance";
import type { RelacionDB } from "@/types";

// ── 1. INTERFACES (La forma de los datos) ──────────────────────────

export interface CountryResponse {
  codpais: string; // Ej: "ESP", "FRA", "GBR"
  name: string; // Ej: "España", "Francia"
}

export interface DocumentTypeResponse {
  coddoc: string; // Ej: "NIF", "PAS"
  name: string; // Ej: "DNI/NIF", "Pasaporte"
}

// ── 2. CACHÉ (Para no saturar al servidor) ─────────────────────────

const cache: {
  countries?: CountryResponse[];
  documentTypes?: DocumentTypeResponse[];
  relationships?: RelacionDB[];
} = {};

// ── 3. FUNCIONES DE LLAMADA A LA API ───────────────────────────────

export async function getCountries(): Promise<CountryResponse[]> {
  // Si ya los tenemos en memoria, los devolvemos al instante
  if (cache.countries) return cache.countries;

  const { data } = await apiAuth.get<CountryResponse[]>("/countries");
  const result = Array.isArray(data) ? data : [];

  if (result.length > 0) {
    // Ordenamos alfabéticamente por nombre antes de guardar en caché
    result.sort((a, b) => a.name.localeCompare(b.name));
    cache.countries = result;
  }

  return result;
}

export async function getDocumentTypes(): Promise<DocumentTypeResponse[]> {
  if (cache.documentTypes) return cache.documentTypes;

  const { data } = await apiAuth.get<DocumentTypeResponse[]>("/documents_type");
  const result = Array.isArray(data) ? data : [];

  if (result.length > 0) {
    cache.documentTypes = result;
  }

  return result;
}

export async function getRelationships(): Promise<RelacionDB[]> {
  if (cache.relationships) return cache.relationships;

  const { data } = await apiAuth.get<RelacionDB[]>("/relationships");
  const result = Array.isArray(data) ? data : [];

  if (result.length > 0) {
    cache.relationships = result;
  }

  return result;
}


