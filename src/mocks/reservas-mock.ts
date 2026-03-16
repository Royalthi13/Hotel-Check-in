import type { Reserva } from "../types";

export const MOCK_RESERVAS: Record<string, Reserva> = {
  "78432": {
    confirmacion: "#LM-78432",
    habitacion: "Suite Junior Deluxe",
    fechaEntrada: "15 mar 2025",
    fechaSalida: "18 mar 2025",
    numHuespedes: 2,
    numNoches: 3,
    habilitado: true,
  },
  "99999": {
    confirmacion: "#LM-99999",
    habitacion: "Habitación Superior",
    fechaEntrada: "22 abr 2025",
    fechaSalida: "25 abr 2025",
    numHuespedes: 1,
    numNoches: 3,
    habilitado: true,
  },
  "44444": {
    confirmacion: "#LM-44444",
    habitacion: "Habitación Estándar",
    fechaEntrada: "10 may 2025",
    fechaSalida: "12 may 2025",
    numHuespedes: 2,
    numNoches: 2,
    habilitado: false,
    motivoDeshabilitado:
      "Su reserva tiene pendiente la validación de la garantía bancaria. Por favor, acuda a recepción con su tarjeta física.",
  },
};
