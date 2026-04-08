import { api } from "./axiosInstance";
import type { Reserva } from "../types";

// 1. Definimos cómo es el objeto exacto que viene de tu FastAPI
interface BackendBooking {
  id: number;
  room_id: number;
  room_name: string;
  check_in: string;
  check_out: string;
  client_id: number;
  client_name: string;
  client_surname: string;
  status_id: number;
  status_name: string;
  persons: number;
  notes: string;
  // ... el resto de campos del backend
}

// 2. Hacemos la llamada GET y mapeamos al formato del frontend
export const getBookingById = async (bookingId: string | number): Promise<Reserva> => {
  // FastAPI Endpoint real
  const { data } = await api.get<BackendBooking>(`/bookings/${bookingId}`);

  // Traducimos el BackendBooking a tu Reserva de React
  return {
    confirmacion: `#LM-${data.id}`, 
    habitacion: data.room_name || "Habitación por asignar",
    fechaEntrada: data.check_in,
    fechaSalida: data.check_out,
    numHuespedes: data.persons,
    // Calculamos las noches basándonos en las fechas
    numNoches: calculateNights(data.check_in, data.check_out),
    
    // ¡MUY IMPORTANTE! Lo necesitamos para buscar al huésped principal luego
    client_id: data.client_id, 
  };
};

// 3. NUEVO: Función para actualizar la reserva (Para cuando terminen el check-in)
export const updateBooking = async (bookingId: string | number, payload: Record<string, unknown>) => {
  // Según tu Swagger, tienes un endpoint PUT /bookings/{booking_id}
  // Aquí puedes enviar el cambio de estado, firmas, u observaciones
  const { data } = await api.put(`/bookings/${bookingId}`, payload);
  return data;
};

// 4. Función auxiliar para calcular las noches
const calculateNights = (inDate: string, outDate: string): number => {
  const diffTime = Math.abs(new Date(outDate).getTime() - new Date(inDate).getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};