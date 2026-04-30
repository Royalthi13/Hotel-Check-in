import { searchCitiesByName } from "./cities.service";

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

// 🧠 DISTANCIA DE LEVENSHTEIN (Algoritmo Profesional de Similitud)
// Calcula cuántas letras hay que cambiar, borrar o añadir para transformar s1 en s2.
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // Sustitución (Ej: O por 0)
          matrix[i][j - 1] + 1, // Inserción
          matrix[i - 1][j] + 1, // Borrado (Ej: " 00" extra)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Devuelve un porcentaje de similitud entre 0.0 (nada) y 1.0 (idénticas)
function calculateSimilarity(s1: string, s2: string): number {
  const a = s1.toUpperCase();
  const b = s2.toUpperCase();
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return (maxLength - distance) / maxLength;
}

export async function normalizeOcrCity(ocrText: string) {
  if (!ocrText || ocrText.length < 3) return null;

  const query = ocrText.toUpperCase().trim();
  console.log(`🔍 [Normalizador] Intentando validar ciudad: "${query}"`);

  // 1. INTENTO EXACTO: Buscamos la frase entera en la API
  let results = await searchCitiesByName(query);

  // 2. ESTRATEGIA DE PREFIJOS (Si la API no encuentra "AZUQUEC0 DE HENAR3S")
  if (results.length === 0) {
    // Buscamos las palabras más largas leídas por el OCR (ej: "AZUQUEC0", "HENAR3S")
    const words = query
      .split(" ")
      .filter((w) => w.length >= 4)
      .sort((a, b) => b.length - a.length);

    // Probamos a pedirle a la API las ciudades que empiecen por las 4 primeras letras de esas palabras
    for (const word of words) {
      const prefix = word.substring(0, 4); // "AZUQ"
      console.log(
        `   ⚠️ Sin resultados exactos. Buscando candidatos por prefijo: "${prefix}"...`,
      );

      const fallbackResults = await searchCitiesByName(prefix);
      if (fallbackResults.length > 0) {
        results = fallbackResults; // ¡Conseguimos candidatos como "Azuqueca de Henares"!
        break;
      }
    }
  }

  // 3. ESTRATEGIA DE POP (Tu código original por si acaso lo anterior falla)
  if (results.length === 0) {
    let parts = query.split(" ");
    while (results.length === 0 && parts.length > 1) {
      parts.pop();
      results = await searchCitiesByName(parts.join(" "));
    }
  }

  // 4. EL JUEZ DE SIMILITUD (Evaluamos a los candidatos)
  if (results.length > 0) {
    // Puntuamos cada ciudad devuelta por la API comparándola con el galimatías del OCR
    const scoredResults = results.map((city) => ({
      ...city,
      score: calculateSimilarity(query, city.name.toUpperCase()),
    }));

    // Ordenamos para que la que tenga el porcentaje más alto quede la primera
    scoredResults.sort((a, b) => b.score - a.score);

    const bestMatch = scoredResults[0];

    // UMBRAL DE ACEPTACIÓN: Exigimos al menos un 50% (0.50) de coincidencia.
    // Así evitamos que si lee "BARCELONA" te ponga "BARAKALDO" por error.
    if (bestMatch.score >= 0.5) {
      console.log(
        `✅ [Normalizador] MATCH FUZZY EXITOSO: "${query}" -> "${bestMatch.name}" (Similitud: ${Math.round(bestMatch.score * 100)}%)`,
      );

      const provCode = bestMatch.codcity.substring(0, 2);
      return {
        name: bestMatch.name.toUpperCase(),
        cp: bestMatch.codcity,
        provincia: PROVINCIAS_MAP[provCode] || "",
      };
    } else {
      console.log(
        `❌ [Normalizador] Descartado. Mejor candidato era "${bestMatch.name}" pero solo se parecía un ${Math.round(bestMatch.score * 100)}% a "${query}".`,
      );
    }
  } else {
    console.log(
      `❌ [Normalizador] La API no devolvió ningún candidato para evaluar.`,
    );
  }

  return null;
}
