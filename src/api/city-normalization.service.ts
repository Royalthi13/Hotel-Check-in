import { searchCitiesByName } from "./cities.service";

export const PROVINCIAS_CP: Record<string, string> = {
  "01": "ÁLAVA",
  "02": "ALBACETE",
  "03": "ALICANTE",
  "04": "ALMERÍA",
  "05": "ÁVILA",
  "06": "BADAJOZ",
  "07": "ILLES BALEARS",
  "08": "BARCELONA",
  "09": "BURGOS",
  "10": "CÁCERES",
  "11": "CÁDIZ",
  "12": "CASTELLÓN",
  "13": "CIUDAD REAL",
  "14": "CÓRDOBA",
  "15": "A CORUÑA",
  "16": "CUENCA",
  "17": "GIRONA",
  "18": "GRANADA",
  "19": "GUADALAJARA",
  "20": "GIPUZKOA",
  "21": "HUELVA",
  "22": "HUESCA",
  "23": "JAÉN",
  "24": "LEÓN",
  "25": "LLEIDA",
  "26": "LA RIOJA",
  "27": "LUGO",
  "28": "MADRID",
  "29": "MÁLAGA",
  "30": "MURCIA",
  "31": "NAVARRA",
  "32": "OURENSE",
  "33": "ASTURIAS",
  "34": "PALENCIA",
  "35": "LAS PALMAS",
  "36": "PONTEVEDRA",
  "37": "SALAMANCA",
  "38": "SANTA CRUZ DE TENERIFE",
  "39": "CANTABRIA",
  "40": "SEGOVIA",
  "41": "SEVILLA",
  "42": "SORIA",
  "43": "TARRAGONA",
  "44": "TERUEL",
  "45": "TOLEDO",
  "46": "VALENCIA",
  "47": "VALLADOLID",
  "48": "BIZKAIA",
  "49": "ZAMORA",
  "50": "ZARAGOZA",
  "51": "CEUTA",
  "52": "MELILLA",
};

// Algoritmo de similitud para evitar "Castellón"
function calculateSimilarity(s1: string, s2: string): number {
  const a = s1.toUpperCase();
  const b = s2.toUpperCase();
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    if (b.includes(a[i])) matches++;
  }
  return matches / Math.max(a.length, b.length);
}

export async function normalizeOcrCity(ocrText: string) {
  if (!ocrText || ocrText.length < 3) return null;

  const query = ocrText.toUpperCase().trim();
  let results = await searchCitiesByName(query);

  let parts = query.split(" ");
  while (results.length === 0 && parts.length > 1) {
    parts.pop();
    results = await searchCitiesByName(parts.join(" "));
  }

  if (results.length > 0) {
    // 🏆 BUSCADOR POR PARECIDO:
    // Comparamos lo que leyó el OCR con los nombres de la API.
    // "CUENDRA" se parecerá más a "AZUQUECA" que a un pueblo de Castellón.
    const bestMatch = results.sort((a, b) => {
      const simA = calculateSimilarity(parts.join(" "), a.name);
      const simB = calculateSimilarity(parts.join(" "), b.name);
      return simB - simA;
    })[0];

    const provCode = bestMatch.codcity.substring(0, 2);
    return {
      name: bestMatch.name.toUpperCase(),
      cp: bestMatch.codcity,
      provincia: PROVINCIAS_CP[provCode] || "",
    };
  }
  return null;
}
