 
export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}
 
export interface BookingResponse {
  id: number;
  confirmation_number: string;
  check_in: string;
  check_out: string;
  num_nights: number;
  num_guests: number;
  client_id: number | null;
  status: string;
  observations: string | null;
  arrival_time: string | null;
  room: RoomResponse | null;
}
 
export interface RoomResponse {
  id: number;
  room_number: string;
  room_type: RoomTypeResponse | null;
}
 
export interface RoomTypeResponse {
  id: number;
  name: string;
}
 
export interface BookingUpdatePayload {
  observations?: string;
  arrival_time?: string;
  status?: string;
}
 
export interface ClientResponse {
  id: number;
  name: string;
  surname: string;
  second_surname: string | null;
  gender: "M" | "F" | null;
  birth_date: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  document_type: string | null;
  document_number: string | null;
  support_number: string | null;
  vat: string | null;
  is_minor: boolean;
}
 
export interface ClientPayload {
  name: string;
  surname: string;
  second_surname?: string;
  gender?: "M" | "F";
  birth_date?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  document_type?: string;
  document_number?: string;
  support_number?: string;
  vat?: string;
  is_minor?: boolean;
}
 
export interface CompanionResponse {
  id: number;
  booking_id: number;
  client_id: number;
  relationship: string | null;
  client: ClientResponse | null;
}
 
export interface CompanionPayload {
  booking_id: number;
  client_id: number;
  relationship?: string;
}
 
export interface CountryResponse {
  codpais: string;
  name: string;
  iso2: string | null;
}
 
export interface DocumentTypeResponse {
  coddoc: string;
  name: string;
}
 
export interface RelationshipResponse {
  codrelation: string;
  name: string;
}
 
export interface CityResponse {
  code: string;
  name: string;
  province?: string;
  postal_code?: string;
  country?: string;
}
 