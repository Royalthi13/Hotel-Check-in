import { api } from "./axiosInstance";

export const getCountries = async () => {
  const { data } = await api.get("/countries");
  return data;
};

export const getDocumentTypes = async () => {
  const { data } = await api.get("/document-types");
  return data;
};
