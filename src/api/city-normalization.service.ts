import { searchCitiesByName } from "./cities.service";

export interface NormalizedCity {
  name: string;
  codcity: string;
  cp: string;
  provincia: string; // ¡Añadimos la provincia para el formulario!
}

// 🗺️ Diccionario oficial del INE: Los 2 primeros dígitos del código postal mandan
const PROVINCIAS_MAP: Record<string, string> = {
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

export async function normalizeOcrCity(
  ocrText: string,
): Promise<NormalizedCity | null> {
  if (!ocrText || ocrText.length < 3) return null;

  let results = await searchCitiesByName(ocrText);

  // 🏆 BUCLE IMPLACABLE: Si el OCR leyó "TORREJON DE ARDOZ MADRID SOS",
  // 1º quita "SOS" -> falla.
  // 2º quita "MADRID" -> ¡Acierta y pilla "TORREJON DE ARDOZ"!
  let parts = ocrText.split(" ");
  while (results.length === 0 && parts.length > 1) {
    parts.pop(); // Borra la última palabra
    const cityOnly = parts.join(" ");
    results = await searchCitiesByName(cityOnly);
  }

  if (results.length > 0) {
    const bestMatch = results[0]; // Cogemos el primer resultado de la API

    // Sacamos los 2 primeros dígitos para saber la provincia
    const provinceCode = bestMatch.codcity.substring(0, 2);

    return {
      name: bestMatch.name.toUpperCase(),
      codcity: bestMatch.codcity,
      cp: bestMatch.codcity, // ¡LO QUE TÚ QUERÍAS! El codcity directo como Código Postal
      provincia: PROVINCIAS_MAP[provinceCode] || "",
    };
  }

  return null;
}
