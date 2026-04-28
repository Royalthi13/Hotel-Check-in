# 🏨 Lumina Hotels — Sistema de Pre-Check-in Online

Plataforma web de alto rendimiento desarrollada en **React 19 + TypeScript + Vite**, diseñada para digitalizar y agilizar el proceso de recepción en hoteles boutique. Funciona en dos modos: enlace mágico enviado por email al huésped, y quiosco táctil en recepción.

---

## 🌟 Características Principales

### Flujo del Huésped (Link Mode)
- **Verificación de acceso anti-enumeración** — al entrar por enlace mágico se solicita email o últimas 3 cifras del teléfono antes de mostrar ningún dato de la reserva.
- **Wizard paso a paso** — Inicio legal → Bienvenida → Escaneo/Manual → Datos Personales → Contacto → Relaciones (menores) → Extras → Revisión → Éxito.
- **Escáner de documentos con OCR** — captura por cámara o galería, pre-procesado con `image-js` y lectura de zona MRZ mediante `tesseract.js`. Extrae nombre, apellidos, fecha de nacimiento, sexo, número de documento, número de soporte y domicilio (con normalización fuzzy de municipios).
- **Gestión multi-huésped** — flujo secuencial para cada acompañante bajo la misma reserva.
- **Menores de edad** — declaración legal obligatoria de parentesco con cada adulto del grupo (Orden INT/1922/2003), con catálogo de relaciones cargado desde la API y relaciones inversas automáticas.
- **Guardado parcial** — el titular puede guardar sus datos y compartir el enlace para que los acompañantes completen el suyo.
- **Revisión y envío final** — pantalla de resumen con edición inline de cualquier bloque antes del envío definitivo.

### Modo Tablet / Kiosko (Staff)
- **Búsqueda por número de reserva + contacto** — el personal introduce el ID de reserva y el email/teléfono del titular para localizarla.
- **Arranque directo** en `/checkin/new` o `/checkin/kiosko/tablet_buscar`.

### Internacionalización completa (i18n)
- **6 idiomas**: Español, Inglés, Francés, Alemán, Portugués, Italiano.
- Detección automática del navegador, con persistencia en `localStorage`.
- Traducciones para todos los textos de UI, mensajes de error, nombres de países, nacionalidades, tipos de documento, sexo, horas de llegada y códigos de parentesco.
- Fechas de reserva localizadas con `Day.js` vinculado al idioma activo.

### Validación de Documentos
- **DNI / NIF** — 8 dígitos + letra de control (módulo 23).
- **NIE** — X/Y/Z + 7 dígitos + letra de control.
- **CIF** — letra organizativa + 7 dígitos + dígito/letra de control.
- **Pasaporte** — 6–15 caracteres alfanuméricos.
- **Número de soporte** — alfanumérico, 8–12 caracteres, con letras y dígitos.
- Validación agnóstica al navegador (`noValidate`) con mensajes 100% en el idioma seleccionado.

---

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Core | React 19 · TypeScript · Vite |
| Estado global | Context API (`CheckinContext` + `useCheckin` reducer) |
| Enrutamiento | React Router DOM v7 |
| UI Components | Material-UI (MUI v7) — DatePicker, Autocomplete, Dialog, Menu |
| Animaciones | Framer Motion (transiciones de pantalla + dot-slider arrastrable) |
| Estilos | CSS Modules + variables CSS globales |
| i18n | i18next + react-i18next + i18next-browser-languagedetector |
| Fechas | Day.js con localización dinámica |
| OCR | Tesseract.js (eng + spa) + image-js + mrz (parser MRZ) |
| HTTP | Axios con interceptores de auth y gestión de errores |
| Flags | flag-icons (CSS) + flagcdn.com (imágenes dinámicas) |

---

## 🏗️ Arquitectura

### Estado Global — `CheckinContext` + `useCheckin`

El hook `useCheckin` implementa un **mini-Redux con `useReducer`** sin dependencias externas:

```
CheckinState
├── appMode: "link" | "tablet"
├── reserva: Reserva | null
├── knownGuest: GuestData | null      ← datos precargados del cliente de la BBDD
├── bookingId / clientId              ← IDs de backend persistidos en el state
├── guests: PartialGuestData[]        ← array de todos los huéspedes
├── numPersonas / numAdultos / numMenores
├── horaLlegada / observaciones
├── legalPassed / hasMinorsFlag / rgpdAcepted
```

**Persistencia dual**: estado en `localStorage` (30 min TTL) para recarga de página; datos de huéspedes adicionales en `sessionStorage` (se borran al cerrar pestaña). Los IDs de backend (`bookingId`, `clientId`) viajan dentro del propio state, nunca como variables sueltas.

### Navegación

`appHistory` es un stack de `{ step, guestIndex }`. `goTo` empuja, `goBack` desapila. La URL refleja siempre el paso actual (`/checkin/:token/:step`), lo que permite restaurar la sesión desde cualquier punto.

El **dot-slider** (móvil) es un `motion.div` arrastrable de Framer Motion. `goToDotIndex` en el panel lateral (escritorio) comparte la misma lógica de validación previa.

### Auth

Dos flujos de autenticación con la misma instancia de Axios (`apiAuth`):

- **Link mágico** — `loginMagicLink()` hace login con credenciales de servicio (`VITE_SERVICE_USER` / `VITE_SERVICE_PASS`) y guarda el JWT en `sessionStorage`. El token del enlace es el `booking_id`, no un JWT.
- **Staff/tablet** — `login(username, password)` estándar con opción de persistencia en `localStorage`.

El interceptor de respuesta en `apiAuth` detecta 401 y dispara el evento `AUTH_EXPIRED`, que `AuthExpiredWatcher` captura para navegar a `/invalid` sin recargar la página.

---

## 📂 Estructura del Proyecto

```
src/
├── api/
│   ├── axiosInstance.ts          # Instancias Axios (api / apiAuth) + token helpers
│   ├── auth.service.ts           # login, logout, loginMagicLink, loginGuest
│   ├── bookings.service.ts       # getBookingById, searchBookingByConfirmation, updateBookingCheckin
│   ├── checkin.service.ts        # loadCheckinData, submitCheckin, savePartialCheckin
│   ├── clients.service.ts        # getClientById, createClient, updateClient + mapeos DB↔Frontend
│   ├── companions.service.ts     # getCompanionsByBooking, createCompanion, deleteCompanion
│   ├── catalogs.service.ts       # getCountries, getDocumentTypes, getRelationships (con caché)
│   ├── cities.service.ts         # searchCitiesByName (con caché en Map)
│   └── city-normalization.service.ts  # normalizeOcrCity — fuzzy matching con Levenshtein
│
├── components/
│   ├── ui/index.tsx              # Icon, Field, Button, Alert, DotsProgress, ConfirmBlock,
│   │                             #   Header, ReservationCard, LoadingSpinner
│   ├── CameraScanner.tsx         # Componente de cámara nativa (overlay con guía)
│   ├── ErrorBoundary.tsx         # Clase React con traducción de errores y botones de recuperación
│   ├── GlobalToast.tsx           # Toast de errores de submit y estado offline (Framer Motion)
│   └── LanguageSelector.tsx      # Dropdown de idioma — modal centrado en móvil, dropdown en desktop
│
├── context/
│   ├── CheckinContextDef.ts      # createContext + interfaz CheckinContextValue
│   ├── CheckinContext.tsx        # Provider: orquesta useCheckin, submit, persistencia, offline
│   └── useCheckinContext.ts      # Hook de consumo con guard
│
├── hooks/
│   ├── useCheckin.ts             # Hook principal: reducer, historia, navegación, carga de datos
│   ├── useFormValidation.ts      # Factory de validación tipada + validatePersonal + validateContacto
│   │                             #   + validarDNI / validarNIE / validarCIF / validarPasaporte
│   ├── useDocumentOCR.ts         # Pipeline OCR completo: EXIF → image-js → Tesseract → MRZ → domicilio
│   ├── usePlaces.ts              # Autocomplete de municipios y provincias españolas
│   ├── useZipCode.ts             # Lookup de CP para países no-ES via Zippopotam.us
│   └── useDebounce.ts            # useEffect con debounce para validación en tiempo real
│
├── layout/
│   ├── AppShell.tsx              # Layout principal: Header + dot-slider + side-panel + AnimatePresence
│   ├── AppShell.css              # Estilos del header, panel lateral, selector de idioma
│   └── FluidProgression.css     # Dot-slider "Instagram" estilo pill arrastrable
│
├── locales/
│   ├── es.json  en.json  fr.json  de.json  pt.json  it.json
│
├── screens/
│   ├── ScreenCheckinInicio.tsx   # Paso 0: reserva + pregunta menores + aceptación legal
│   ├── ScreenBienvenida.tsx      # Paso 1: elección scan vs. manual (titular y acompañantes)
│   ├── ScreenEscanear.tsx        # Paso 2 (opcional): cámara / galería / PDF + procesado OCR
│   ├── ScreenForms.tsx           # Pasos 3–4: ScreenFormPersonal + ScreenFormContacto (MUI)
│   ├── ScreenRelacionesMenor.tsx # Paso 5: parentescos de menores con adultos del grupo
│   ├── ScreenExtrasRevisionExito.tsx  # Pasos 6–8: Extras, Revisión, Éxito / Éxito Parcial
│   ├── ScreenTabletBuscar.tsx    # Modo tablet: búsqueda por reserva + contacto
│   └── ScreenVerificarAcceso.tsx # Verja anti-enumeración: email o últimas 3 cifras teléfono
│
├── types/index.ts                # Todos los tipos: AppMode, StepId, Reserva, GuestData,
│                                 #   PartialGuestData, CheckinState, CheckinNav, CheckinActions…
│
└── utils/
    ├── formatters.ts             # formatDocument (DNI/NIE con guiones), formatPhoneNumber
    └── surnames.ts               # splitSurnames — separa apellido1 y apellido2 con conectores
```

---

## 🔌 API — Endpoints Consumidos

Base URL configurable via `VITE_API_URL` (fallback a `/api`).

### Autenticación
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/auth/token` | Login estándar (form-urlencoded). Devuelve `access_token`. |
| `POST` | `/auth/guest-login` | Login de huésped con `booking_id` + `surname`. |

### Reservas
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/bookings/{id}` | Obtiene reserva por ID. Devuelve `BookingSearch` completo. |
| `PUT` | `/bookings/{id}` | Actualiza reserva (marca `pre_checking: true`, añade `notes`, vincula `client_id`). |

### Clientes
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/clients/{id}` | Obtiene datos completos de un cliente. |
| `POST` | `/clients` | Crea nuevo cliente. Devuelve `{ id }`. |
| `PUT` | `/clients/{id}` | Actualiza cliente existente. |

### Acompañantes
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/companions/booking/{bookingId}` | Lista acompañantes de una reserva. |
| `POST` | `/companions` | Crea vínculo acompañante (`booking_id`, `client_id`, `parentesco`). |
| `DELETE` | `/companions/{id}` | Elimina vínculo acompañante. |

### Catálogos (con caché en memoria)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/countries` | Lista de países (`codpais`, `name`). Ordenada alfabéticamente. |
| `GET` | `/documents_type` | Tipos de documento (`coddoc`, `name`). |
| `GET` | `/relationships` | Tipos de relación/parentesco (`codrelation`, `name`, `linked_relation`). |

### Municipios
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/cities/name/{name}` | Búsqueda de municipios españoles por nombre. Devuelve `codcity` (código INE) + `name`. Retorna 204 si no hay resultados. |

---

## 🔄 Flujo de Envío (`submitCheckin`)

El envío final en `checkin.service.ts` ejecuta estos pasos en orden:

1. **Catálogo de relaciones** — carga `getRelationships()` para resolver códigos inversos.
2. **Parentescos** — para cada menor, asigna `parentescoParaAPI` al adulto responsable usando `linked_relation` del catálogo.
3. **Herencia de dirección** — si el menor no tiene dirección propia y su relación es `PM` o `TU`, copia la dirección del adulto responsable.
4. **Titular** — si existe `clientId`, hace `updateClient`; si no, `createClient` y guarda el nuevo ID.
5. **Acompañantes** — itera el array restante, crea o actualiza cada cliente, guarda el `parentesco` en un mapa.
6. **Limpieza** — obtiene acompañantes actuales de la reserva y borra los que no pertenezcan al submit actual.
7. **Vinculación** — crea los nuevos vínculos en `/companions` con el parentesco correspondiente.
8. **Cierre** — `updateBookingCheckin` marca `pre_checking: true`, graba la hora de llegada en `notes` y vincula `client_id`.

---

## 🗺️ Mapeos DB ↔ Frontend (`clients.service.ts`)

| Campo DB | Campo Frontend | Ejemplo |
|---|---|---|
| `country` (codpais) | `pais` (ISO2) | `"ESP"` → `"ES"` |
| `nationality` (codpais) | `nacionalidad` (label) | `"ESP"` → `"Española"` |
| `doc_type` | `tipoDoc` | `"NIF"` → `"DNI"`, `"PAS"` → `"Pasaporte"` |
| `vat` | `numDoc` | número del documento |
| `doc_support` | `soporteDoc` | número de soporte |
| `sex` | `sexo` | `"M"` → `"Hombre"`, `"F"` → `"Mujer"` |
| `surname` | `apellido` + `apellido2` | split via `splitSurnames()` |
| `phone` | `prefijo` + `telefono` | `"+34 612 34 56 78"` |
| `relationship` | `relacionesConAdultos[0].parentesco` | `"HJ"`, `"TU"`, etc. |
| `cod_city` | `codCity` | código INE del municipio |

---

## 🧠 Pipeline OCR (`useDocumentOCR`)

```
File (JPG/PNG/PDF)
  │
  ▼ loadExifCorrectedBlob()
Blob corregido y recortado a ratio 3:2
  │
  ▼ buildMrzVariants() — image-js
  • 4 zonas de recorte (50–76% inferior)
  • 3 niveles de contraste (std / hico / dark)
  • 1 variante full-image en PSM SPARSE_TEXT
  │
  ▼ runMrzOCR() × N variantes — Tesseract.js (eng+spa)
  • Whitelist: A-Z 0-9 <
  • findBestMRZ(): prueba TD1 (2 líneas 44) + TD3 (3 líneas 30)
  • Score de validez por campo, umbral mínimo 28%
  │
  ▼ mrzToGuest()
  • Nombre / Apellidos (lógica española: 2 apellidos + nombre)
  • Fecha de nacimiento, Sexo, Nacionalidad → ISO2
  • DNI 4.0: extrae numDoc de optional1 con regex
  • Pasaporte: documentNumber como numDoc
  │
  ▼ buildAddressVariantNative() + runTextOCR() [solo TD1]
  • Recorte 60% superior de la cara trasera
  • parseDniBackAddress(): extrae calle, número, ciudad
  │
  ▼ normalizeOcrCity() — Levenshtein fuzzy matching
  • Consulta /cities/name/{prefix}
  • Umbral de similitud ≥ 50%
  • Rellena codCity + CP + provincia
```

---

## ⚙️ Variables de Entorno

```env
VITE_API_URL=https://api.tuhotel.com/api   # Base URL del backend
VITE_SERVICE_USER=service_account           # Usuario para login mágico
VITE_SERVICE_PASS=service_password          # Contraseña para login mágico
```

---

## 🚦 Rutas

| Ruta | Descripción |
|---|---|
| `/` | Redirige a `/checkin/new` |
| `/checkin/new` | Modo tablet — muestra `ScreenTabletBuscar` |
| `/checkin/:token` | Modo link — carga reserva por token (= booking_id) |
| `/checkin/:token/:step` | Paso específico del wizard (permite restaurar sesión) |
| `/checkin/kiosko/tablet_buscar` | Acceso directo al kiosko de staff |
| `/invalid` | Enlace inválido o sesión expirada |
| `*` | Fallback a `/invalid` |

---

## 🛡️ Seguridad

- **Verja anti-enumeración** — antes de mostrar datos de la reserva se verifica email (coincidencia exacta) o últimas 3 cifras del teléfono. Tras 3 intentos fallidos redirige a `/invalid`.
- **JWT con TTL** — el token se guarda en `sessionStorage` (o `localStorage` para staff) con un expiry de 300 min. `getToken()` valida el expiry en cada petición.
- **Evento `AUTH_EXPIRED`** — el interceptor Axios emite un `CustomEvent` en lugar de forzar `location.reload()`, respetando el enrutamiento de React Router.
- **OCR local** — el procesado de documentos se realiza íntegramente en el navegador; ninguna imagen sale del dispositivo.
- **`noValidate`** en todos los formularios — elimina validación nativa del navegador para garantizar mensajes coherentes con i18n.

---

## 🏃 Arranque Local

```bash
# Instalar dependencias
npm install

# Variables de entorno
cp .env.example .env
# Editar VITE_API_URL, VITE_SERVICE_USER, VITE_SERVICE_PASS

# Desarrollo
npm run dev

# Build de producción
npm run build
```

El proyecto requiere **Node.js ≥ 18**. Tesseract.js descarga los modelos de idioma en la primera ejecución (~20 MB); en producción se recomienda servirlos desde un CDN propio para evitar latencia.
