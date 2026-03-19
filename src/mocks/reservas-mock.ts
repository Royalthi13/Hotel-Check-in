import type { Reserva } from "@/types";

export const MOCK_RESERVAS: Record<string, Reserva> = {
  "78432": {
    confirmacion: "#LM-78432",
    habitacion: "Suite Junior Deluxe",
    fechaEntrada: "15 mar 2025",
    fechaSalida: "18 mar 2025",
    numHuespedes: 2,
    numNoches: 3,
  },
  "99999": {
    confirmacion: "#LM-99999",
    habitacion: "Habitación Superior",
    fechaEntrada: "22 abr 2025",
    fechaSalida: "25 abr 2025",
    numHuespedes: 1,
    numNoches: 3,
  },
  "12345": {
    confirmacion: "#LM-12345",
    habitacion: "Habitación 343",
    fechaEntrada: "22 abr 2025",
    fechaSalida: "25 abr 2025",
    numHuespedes: 5,
    numNoches: 3,
  },
};
