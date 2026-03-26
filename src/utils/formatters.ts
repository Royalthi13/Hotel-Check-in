export const formatDocument = (val: string, tipo: string): string => {
  let cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (tipo === "DNI") {
    cleaned = cleaned.slice(0, 9);
    if (cleaned.length > 8) return `${cleaned.slice(0, 8)}-${cleaned.slice(8)}`;
  }
  if (tipo === "NIE") {
    cleaned = cleaned.slice(0, 9);
    if (cleaned.length > 8)
      return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 8)}-${cleaned.slice(8)}`;
  }

  return cleaned;
};

export const formatPhoneNumber = (val: string): string => {
  const cleaned = val.replace(/(?!^\+)[^\d]/g, "");

  let prefix = "";
  let digits = cleaned;

  if (cleaned.startsWith("+")) {
    const match = cleaned.match(/^(\+\d{2,3})(\d.*)?$/);
    if (match) {
      prefix = match[1] + " ";
      digits = match[2] || "";
    } else {
      return cleaned;
    }
  }

  let result = "";
  if (digits.length > 0) result += digits.substring(0, 3);
  if (digits.length > 3) result += " " + digits.substring(3, 5);
  if (digits.length > 5) result += " " + digits.substring(5, 7);
  if (digits.length > 7) result += " " + digits.substring(7, 9);

  if (digits.length > 9) result += " " + digits.substring(9);

  return prefix + result;
};
