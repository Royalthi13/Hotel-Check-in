import { api } from "./axiosInstance";
import { getBookingById } from "./bookings.service";
// Importaremos esto cuando crees el servicio de clientes
// import { getClientById } from "./clients.service"; 

export const checkinService = {
  /**
   * Esta función se dispara cuando el huésped entra por el enlace del correo.
   * Recibe el token (o ID de reserva por ahora) de la URL.
   */
  loadCheckinFromEmail: async (tokenOrId: string) => {
    try {
      // 1. Obtenemos la reserva (usando el servicio que creamos en el paso anterior)
      // Si en el futuro usas un hash seguro, aquí llamarías a otro endpoint.
      const reserva = await getBookingById(tokenOrId);

      // 2. Aquí llamaremos al backend para sacar los datos del cliente principal
      // Asumiendo que el endpoint de reserva te devuelve el client_id
      const resClient = await api.get(`/clients/${reserva.client_id}`);
      const clientData = resClient.data;

      // 3. (Opcional) Llamar a los acompañantes si ya existen
      // const resCompanions = await api.get(`/companions/booking/${tokenOrId}`);

      // 4. Devolvemos todo empaquetado para que tu React Context lo entienda
      return {
        reserva: reserva,
        huespedPrincipal: {
          nombre: clientData.name,
          apellidos: clientData.surname,
          email: clientData.email,
          telefono: clientData.phone,
          // ... mapea el resto de campos que necesite tu frontend
        },
        acompanantes: [] 
      };

    } catch (error) {
      console.error("Error cargando datos del enlace de pre-checkin", error);
      throw error; // Lo lanzamos para que la UI muestre el mensaje de "Enlace inválido"
    }
  }
};