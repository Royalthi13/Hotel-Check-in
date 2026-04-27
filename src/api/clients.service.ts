import { apiAuth } from "./axiosInstance";
import type { PartialGuestData, GuestData } from "@/types";

/**
 * Mapea los datos del frontend (camelCase) al contrato del backend (snake_case)
 * Implementación: codCity -> cod_city
 */
function mapGuestToApi(guest: PartialGuestData) {
  return {
    name: guest.nombre,
    surname1: guest.apellido,
    surname2: guest.apellido2 || "",
    id_type: guest.tipoDoc,
    id_num: guest.numDoc,
    sub_num: guest.soporteDoc || "",
    gender: guest.sexo,
    birth_date: guest.fechaNac,
    nationality: guest.nacionalidad,
    address: guest.direccion,
    city: guest.ciudad,
    cod_city: guest.codCity || null,
    province: guest.provincia,
    zip_code: guest.cp,
    country: guest.pais,
    email: guest.email,
    phone: guest.telefono,
  };
}

export async function getClientById(id: number): Promise<GuestData> {
  const { data } = await apiAuth.get<GuestData>(`/clients/${id}`);
  return data;
}

export async function createClient(guest: PartialGuestData): Promise<number> {
  const payload = mapGuestToApi(guest);
  const { data } = await apiAuth.post<{ id: number }>("/clients", payload);
  return data.id;
}

export async function updateClient(
  id: number,
  guest: PartialGuestData,
): Promise<void> {
  const payload = mapGuestToApi(guest);
  await apiAuth.put(`/clients/${id}`, payload);
}

export async function deleteClient(id: number): Promise<void> {
  await apiAuth.delete(`/clients/${id}`);
}
