export interface SplitSurnamesResult {
  apellido: string;
  apellido2: string;
}

const SURNAME_CONNECTORS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "i",
  "da",
  "das",
  "do",
  "dos",
  "van",
  "von",
  "di",
]);

function normalizeSpaces(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function splitFromSingleSurname(surnameRaw: string | null | undefined): SplitSurnamesResult {
  const surname = normalizeSpaces(surnameRaw);
  if (!surname) return { apellido: "", apellido2: "" };

  const tokens = surname.split(" ");
  if (tokens.length === 1) return { apellido: tokens[0], apellido2: "" };
  if (tokens.length === 2) return { apellido: tokens[0], apellido2: tokens[1] };

  const secondSurnameTokens = [tokens[tokens.length - 1]];
  let idx = tokens.length - 2;
  while (idx >= 1 && SURNAME_CONNECTORS.has(tokens[idx].toLowerCase())) {
    secondSurnameTokens.unshift(tokens[idx]);
    idx -= 1;
  }

  const firstSurname = tokens.slice(0, idx + 1).join(" ").trim();
  const secondSurname = secondSurnameTokens.join(" ").trim();
  if (!firstSurname) return { apellido: surname, apellido2: "" };

  return { apellido: firstSurname, apellido2: secondSurname };
}

export function splitSurnames(
  apellidoRaw: string | null | undefined,
  apellido2Raw?: string | null | undefined,
): SplitSurnamesResult {
  const apellido = normalizeSpaces(apellidoRaw);
  const apellido2 = normalizeSpaces(apellido2Raw);

  // Si ya vienen separados, se respetan tal cual.
  if (!apellido || apellido2) return { apellido, apellido2 };

  return splitFromSingleSurname(apellido);
}
