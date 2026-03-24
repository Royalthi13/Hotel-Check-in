# 🏨 Lumina Hotels - Pre-Check-in Online

Plataforma web React para la gestión del pre-check-in online y quioscos físicos de Lumina Hotels. Permite a los huéspedes confirmar sus datos, añadir acompañantes (incluyendo declaración legal de menores), subir documentos y configurar sus preferencias antes de su llegada al hotel.

## 🚀 Tecnologías Principales

- **Core:** React 19 + TypeScript + Vite
- **Enrutamiento:** React Router DOM v7
- **Estilos y UI:** CSS Modules (Variables CSS Globales), Material-UI (MUI v7), Emotion, Framer Motion (animaciones de transiciones)
- **Internacionalización:** i18next (Soporte para ES, EN, FR, DE, PT)
- **Manejo de Fechas:** Day.js
- **Mocking de API (Desarrollo):** MSW (Mock Service Worker)

## 🎨 Sistema de Diseño y Paleta de Colores

El proyecto utiliza un sistema de diseño basado en variables CSS (definidas en `src/App.css` y tipadas en `src/constants/index.ts`).

### Colores Principales

- 🟠 **Primary:** `#fa865c` (Naranja coral)
  - Dark: `#e5704a` | Light (Fondo): `#fef0ea`
- 🔵 **Secondary:** `#324154` (Azul marino/Pizarra)
  - Mid: `#4a5a6e` | Light: `#6a7a8e`

### Fondos y Superficies

- ⚪ **Background Base:** `#e5e2dd` (Gris cálido claro)
- ⬜ **Cards/White:** `#ffffff`
- 🔘 **Bordes:** `#d0cbc4` (Normal) | `#e8e4de` (Light)

### Estados y Alertas

- ✅ **Éxito (OK):** `#2d7a50` | Fondo: `#edf7f1`
- ❌ **Error:** `#c0392b` | Fondo: `#fdf2f2`

### Tipografía

- **Titulares:** `Cormorant Garamond` (Elegante, estilo hotel boutique)
- **Cuerpo / UI:** `DM Sans` (Limpia, moderna, altamente legible)

## 📂 Arquitectura del Proyecto

```text
src/
├── assets/         # Imágenes estáticas y SVGs
├── components/     # Componentes UI reutilizables (ErrorBoundary, LanguageSelector, index.tsx con iconos)
├── constants/      # Constantes globales (Países, Docs, Colores, Steps del Wizard)
├── hooks/          # Custom hooks (Lógica de estado del check-in, validación de formularios, debounce, APIs externas)
├── layout/         # Componentes estructurales (AppShell con navegación lateral y animaciones)
├── locales/        # Archivos JSON con las traducciones (i18n)
├── mocks/          # MSW handlers para simular respuestas del servidor (desarrollo)
├── screens/        # Vistas de la aplicación separadas por paso del wizard
└── types/          # Definiciones de interfaces TypeScript
```
