# 🏨 Sistema de Pre-Check-in Online

Plataforma web de alto rendimiento desarrollada en React 19, diseñada para digitalizar y agilizar el proceso de recepción en hoteles boutique. La aplicación permite a los huéspedes completar su registro de forma remota o mediante quioscos táctiles, garantizando el cumplimiento legal y mejorando la experiencia del usuario (UX) antes de su llegada.

## 🌟 Características Principales

- **Flujo de Asistente (Wizard) Inteligente:** Proceso guiado paso a paso para la recolección de datos personales, de contacto y preferencias.
- **Gestión Multi-Huésped:** Capacidad para gestionar múltiples acompañantes bajo una misma reserva, diferenciando entre el titular y el resto de huéspedes.
- **Validación de Menores de Edad:** Lógica de negocio integrada para la declaración legal de menores, incluyendo la captura de datos de tutores y parentesco.
- **Captura de Documentación:** Sistema simulado de carga de documentos (DNI, NIE, Pasaporte) con validación de números de soporte y formatos específicos.
- **Internacionalización Real (i18n):** Soporte completo para 5 idiomas (ES, EN, PT, FR, DE) que afecta a toda la interfaz, mensajes de error y formatos de fecha.
- **Resumen y Revisión:** Pantalla final de verificación de datos antes del envío definitivo a los sistemas del hotel.

## 🚀 Stack Tecnológico

- **Core:** React 19 + TypeScript + Vite.
- **Estado Global:** Context API (`CheckinContext`) para una gestión eficiente y centralizada de los datos de la reserva entre pantallas.
- **Enrutamiento:** React Router DOM v7 (Data Routes) para una navegación fluida y protegida.
- **UI & Animaciones:**
  - **Material-UI (MUI v7):** Implementación de componentes de formulario complejos, Autocompletes y DatePickers.
  - **Framer Motion:** Animaciones de transición entre pasos para reducir la carga cognitiva del usuario.
  - **CSS Modules:** Estilado modular con variables CSS globales para un mantenimiento sencillo del branding.
- **Utilidades de Datos:**
  - **i18next:** Motor de traducción dinámica.
  - **Day.js:** Gestión de fechas con localización dinámica según el idioma del huésped.

## 🛠️ Arquitectura y Soluciones Técnicas

### 1. Gestión de Validación de Lado del Cliente

Se ha implementado una estrategia de **Validación Agóstica al Navegador** mediante el atributo `noValidate` en los formularios. Esto permite anular los mensajes nativos del navegador y sustituirlos por un motor de validación propio integrado con `i18next`, garantizando que el 100% de los errores sean coherentes con el idioma seleccionado.

### 2. Localización Dinámica de Datos (Context-Aware)

A diferencia de los sistemas estáticos, Lumina Hotels utiliza **Day.js** vinculado al estado de la aplicación. Las fechas de la reserva se formatean dinámicamente, traduciendo nombres de meses y aplicando reglas de capitalización visual mediante CSS, asegurando una interfaz profesional en cualquier cultura.

### 3. Diseño Responsivo y Equilibrio Óptico

El Header y los componentes estructurales utilizan **CSS Grid Simétrico** (`100px 1fr 100px`) y posicionamiento absoluto en móviles para garantizar que el branding de Lumina se mantenga siempre como el punto focal, independientemente de la densidad de botones de acción en los laterales.

## 📂 Estructura del Proyecto

```text
src/
├── components/     # UI Atómica: Botones, Iconos, Alertas y la ReservationCard
├── context/        # CheckinContext: Gestión del estado global y persistencia
├── hooks/          # useFormValidation, useZipCode, usePlaces, useDebounce
├── layout/         # AppShell: Contenedor principal con navegación y animaciones
├── locales/        # Diccionarios i18n (JSON) en 5 idiomas
├── mocks/          # Mocking de API: Datos de reserva simulados en formato ISO
├── screens/        # Vistas del Wizard: Personal, Contacto, Relaciones, Review
├── types/          # Tipado estricto de TypeScript para el modelo de negocio
└── utils/          # Lógica pura: Formateadores y validadores de documentos
```
