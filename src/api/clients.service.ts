import { api } from "./axiosInstance";
import type { ClientResponse, ClientPayload } from "./api.types";
import type { GuestData, PartialGuestData } from "@/types";
 
function toGuestData(c: ClientResponse): GuestData {
  return {
    nombre:    c.name    ?? "",
    apellido:  c.surname ?? "",
    apellido2: c.second_surname ?? "",
    sexo:
      c.gender === "M" ? "Hombre"
      : c.gender === "F" ? "Mujer"
      : "No indicar",
    fechaNac:     c.birth_date      ?? "",
    nacionalidad: c.nationality     ?? "Española",
    email:        c.email           ?? "",
    telefono:     c.phone           ?? "",
    direccion:    c.address         ?? "",
    ciudad:       c.city            ?? "",
    provincia:    c.province        ?? "",
    cp:           c.postal_code     ?? "",
    pais:         c.country         ?? "ES",
    tipoDoc:      c.document_type   ?? "DNI",
    numDoc:       c.document_number ?? "",
    soporteDoc:   c.support_number  ?? "",
    vat:          c.vat             ?? "",
    esMenor:      c.is_minor        ?? false,
    relacionesConAdultos: [],
  };
}
 
export function toClientPayload(g: PartialGuestData): ClientPayload {
  return {
    name:            (g.nombre    ?? "").trim(),
    surname:         (g.apellido  ?? "").trim(),
    second_surname:  (g.apellido2 ?? "").trim()      || undefined,
    gender:
      g.sexo === "Hombre" ? "M"
      : g.sexo === "Mujer" ? "F"
      : undefined,
    birth_date:      g.fechaNac      || undefined,
    nationality:     g.nacionalidad  || undefined,
    email:           (g.email     ?? "").trim() || undefined,
    phone:           (g.telefono  ?? "").trim() || undefined,
    address:         (g.direccion ?? "").trim() || undefined,
    city:            (g.ciudad    ?? "").trim() || undefined,
    province:        (g.provincia ?? "").trim() || undefined,
    postal_code:     (g.cp        ?? "").trim() || undefined,
    country:         g.pais        || undefined,
    document_type:   g.tipoDoc     || undefined,
    document_number: (g.numDoc     ?? "").trim() || undefined,
    support_number:  (g.soporteDoc ?? "").trim() || undefined,
    vat:             (g.vat        ?? "").trim() || undefined,
    is_minor:        g.esMenor ?? false,
  };
}
 
export async function getClientById(clientId: number): Promise<GuestData> {
  const { data } = await api.get<ClientResponse>(`/clients/${clientId}`);
  return toGuestData(data);
}
 
export async function createClient(guest: PartialGuestData): Promise<number> {
  const { data } = await api.post<ClientResponse>("/clients", toClientPayload(guest));
  return data.id;
}
 
export async function updateClient(
  clientId: number,
  guest: PartialGuestData
): Promise<void> {
  await api.put(`/clients/${clientId}`, toClientPayload(guest));
}
 
export async function validateClient(clientId: number): Promise<void> {
  await api.patch(`/clients/${clientId}/validate`);
}
 