import type { Reserva } from "@/types";

export const MOCK_RESERVAS: Record<string, Reserva> = {
  "78432": {
    confirmacion: "#LM-78432",
    habitacion: "Suite Junior Deluxe",
    fechaEntrada: "2025-03-15",
    fechaSalida: "2025-03-18",
    numHuespedes: 2,
    numNoches: 3,
  },
  "99999": {
    confirmacion: "#LM-99999",
    habitacion: "Habitación Superior",
    fechaEntrada: "2025-04-15",
    fechaSalida: "2025-04-18",
    numHuespedes: 1,
    numNoches: 3,
  },
  "12345": {
    confirmacion: "#LM-12345",
    habitacion: "Habitación 343",
    fechaEntrada: "2025-04-15",
    fechaSalida: "2025-04-18",
    numHuespedes: 5,
    numNoches: 3,
  },
};
