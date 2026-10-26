# ClubOS — MVP (los 6 módulos del roadmap, listo para piloto real)

Prototipo funcional completo: la fase 1 del roadmap (Gestión + Scouting) más
los cuatro módulos agregados en la fase 2 (**Videoanálisis**,
**Entrenamientos**, **Data analyst** y **Físico-médico**), todo backend +
web app, con la **ficha única del jugador** uniendo los seis. Los 6 módulos
del roadmap original ya están construidos, y la plataforma ya tiene lo que
hace falta para usarse como piloto real en un club: acceso por sector
(cada persona ve y carga solo lo suyo), alta de usuarios reales y una guía
de despliegue a una URL pública (ver `DEPLOY.md`).

## Qué incluye

- **Backend** (`backend/`): API REST en Node.js + TypeScript + Express, con
  autenticación por rol (JWT), control de acceso por sector (ver abajo) y
  una base de datos SQLite (sin infraestructura externa) que sirve de
  fuente única de verdad.
- **Frontend** (`frontend/`): app web en React + TypeScript + Vite, con
  Dashboard, Plantilla (gestión), Data analyst, Scouting, Videoanálisis,
  Entrenamientos, Físico-médico, la Ficha del jugador que combina las seis,
  y una pantalla de Usuarios (solo Admin) para dar de alta al resto del
  club.
- **Videoanálisis** (`/video`): cada clip es un link a un video (no se sube
  el binario en este prototipo — ver "Datos/video/integraciones" en la
  Arquitectura técnica) asociado a un jugador, con una línea de tiempo de
  marcas (minuto + etiqueta + nota) que carga el scout mientras lo mira.
- **Entrenamientos** (`/entrenamientos`): calendario de sesiones (fecha +
  tipo: físico, táctico, técnico, recuperación, partido) y asistencia por
  jugador (presente / ausente / lesionado + carga de esfuerzo RPE). La
  asistencia de cada jugador también se ve en su ficha única.
- **Data analyst** (`/data`): rendimiento partido a partido por jugador
  (minutos, goles, asistencias, rating) y una tabla agregada del plantel
  (partidos jugados, goles y asistencias totales, rating promedio) calculada
  sobre esos registros — sin pipeline de datos externo en este prototipo
  (ver Arquitectura técnica para la versión con proveedores tipo Opta/Wyscout).
- **Físico-médico** (`/fisico-medico`): dos tipos de registro por jugador:
  partes médicos (lesión, control médico, alta, con estado
  activa/recuperación/alta y retorno estimado) y tests físicos (peso, grasa
  corporal, VO2 max, sprint, salto). El plantel se ve con un aviso de
  "Lesionado" para quien tenga una lesión activa.
- **Usuarios** (`/usuarios`, solo Admin): alta de cuentas reales del club
  (nombre, email, sector, contraseña inicial) — ver "Acceso por sector"
  abajo.

## Acceso por sector (quién ve qué)

Un club real no tiene a todo el mundo mirando todo: dirigencia no necesita
ver los partes médicos, el preparador físico no necesita ver contratos, un
scout externo no debería ver la ficha médica del plantel. Por eso el
control de acceso en ClubOS restringe **lectura y escritura**, no solo
escritura — y lo hace en el backend (el dato ni siquiera viaja en la
respuesta si el rol no lo puede ver), no escondiendo cosas en la pantalla.

| Rol | Sectores que ve y carga |
| --- | --- |
| **Administrador** | Todos (Gestión, Scouting, Video, Entrenamientos, Data, Físico-médico) + pantalla de Usuarios |
| **Dirigencia / Gestión del club** | Gestión (plantel, contratos, valor de mercado) |
| **Cuerpo técnico / DT** | Entrenamientos, Data, Video |
| **Preparador físico / Kinesiólogo** | Físico-médico |
| **Ojeador / Scout** | Scouting, Video |

La ficha única del jugador (`/jugador/:id`) arma dinámicamente solo las
secciones que el rol que la pide puede leer: dirigencia ve contrato y datos
personales, el preparador físico ve solo partes médicos y tests físicos,
el cuerpo técnico ve rendimiento y asistencia, etc. — nunca el mismo JSON
recortado en el front, sino una respuesta distinta por rol.

Solo el Administrador entra a **Usuarios**, donde se da de alta a cada
persona real del club con su sector correspondiente (ver `DEPLOY.md`, paso
6, para el flujo completo en un despliegue nuevo).

## Por qué SQLite y no Postgres en este prototipo

La arquitectura recomendada en el estudio de mercado usa Postgres en
producción. Para este prototipo se usa SQLite (con consultas SQL directas,
sin ORM) porque corre sin instalar ni configurar un servidor de base de
datos aparte. El modelo de datos (`backend/sql/schema.sql`) está escrito
para portar fácilmente a Postgres cuando el proyecto sume un servidor real.
En el despliegue real (ver `DEPLOY.md`) el archivo SQLite vive en un
volumen persistente, así que sobrevive a reinicios y redeploys.

## Cómo correrlo en local (desarrollo/demo)

Necesitás Node.js 18 o superior instalado.

### 1. Backend

```bash
cd backend
npm install
npm run seed   # crea la base y carga datos de ejemplo (usuarios + jugadores ficticios)
npm run dev    # http://localhost:4000
```

### 2. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

Abrí `http://localhost:5173` en el navegador.

### Usuarios de prueba (solo en el seed de desarrollo)

| Email | Contraseña | Rol | Sectores |
| --- | --- | --- | --- |
| `admin@clubos.demo` | `clubos2026` | Administrador | Todos + Usuarios |
| `dirigencia@clubos.demo` | `clubos2026` | Dirigencia / Gestión del club | Gestión |
| `tecnico@clubos.demo` | `clubos2026` | Cuerpo técnico / DT | Entrenamientos, Data, Video |
| `fisico@clubos.demo` | `clubos2026` | Preparador físico / Kinesiólogo | Físico-médico |
| `scout@clubos.demo` | `clubos2026` | Ojeador / Scout | Scouting, Video |

Esto es control de acceso por rol real (no cosmético): probá entrar como
`fisico` — en el menú solo aparecen Resumen y Físico-médico, el Dashboard
solo muestra sus estadísticas y su parte del feed de actividad, y si se
intenta pedir por API un dato de otro sector (por ejemplo un informe de
scouting), el backend lo rechaza con 403, tal como lo planteamos en la
sección de Seguridad del estudio de mercado.

> Nota: este seed con usuarios y jugadores de ejemplo es solo para
> desarrollo/demo. Un despliegue real (`DEPLOY.md`) arranca **sin datos de
> ejemplo**, con un único usuario Administrador real creado por variables
> de entorno, y el resto de las cuentas se dan de alta a mano desde
> Usuarios.

## Cómo desplegarlo para un piloto real

Ver `DEPLOY.md` — guía paso a paso (sin terminal, todo clicks) para dejar
ClubOS corriendo en una URL pública real (Railway), con los datos
persistiendo entre reinicios y las cuentas reales del club.

## Qué mostrar en la demo

1. Entrar como `admin` → ver el Dashboard con el feed que mezcla actividad
   de Gestión, Data, Scouting, Video, Entrenamientos y Físico-médico.
2. Ir a Data, ver la tabla de rendimiento del plantel (goles, asistencias,
   rating promedio) — esto hoy suele vivir en una planilla de Excel aparte.
3. Ir a Scouting, elegir un candidato (por ejemplo Martín Díaz) y cargar un
   informe nuevo.
4. Ir a Video, elegir el clip de Martín Díaz y ver la línea de tiempo de
   marcas (gol, jugada clave, error) — esto es lo que hoy vive en una
   herramienta aparte (Wyscout, Hudl) y acá queda linkeado al mismo jugador.
5. Ir a Entrenamientos, elegir una sesión y cargar la asistencia de un
   jugador (presente/ausente/lesionado + RPE) — esto hoy suele vivir en una
   planilla aparte del cuerpo técnico.
6. Ir a Físico-médico, elegir un jugador (por ejemplo Diego Martínez, que
   tiene una lesión activa) y ver el parte médico y los tests físicos — hoy
   suele vivir en una carpeta aparte del cuerpo médico, sin conexión con el
   resto del club.
7. Ir a Gestión → abrir la ficha de Juan Pérez y ver cómo conviven en una
   sola pantalla los datos de contrato, el rendimiento, los partes médicos,
   los tests físicos y la asistencia a entrenamientos — esa es la "ficha
   única" del pitch deck, ahora con los seis módulos adentro.
8. Salir y volver a entrar como `fisico` (o `dirigencia`, o `tecnico`) para
   ver el acceso por sector en acción: el menú, el Dashboard y la ficha del
   jugador muestran solo lo que ese rol puede ver, y punto — no es que las
   opciones estén ahí pero deshabilitadas.
9. Como `admin`, ir a Usuarios y mostrar cómo se da de alta a una persona
   real del club con su sector correspondiente.

## Qué falta para que sea un producto real

- Los 6 módulos del roadmap original ya están construidos, y la plataforma
  ya soporta desplegarse como piloto real con cuentas y acceso por sector
  (ver `DEPLOY.md`). Lo que sigue es validación con el club piloto y los
  puntos de abajo.
- Subida y almacenamiento real de archivos de video (hoy Videoanálisis
  guarda un link externo, no el binario — ver "Datos/video/integraciones"
  en la Arquitectura técnica).
- Integración con proveedores de datos externos (Opta, Wyscout, StatsBomb)
  para que Data analyst no dependa de carga manual partido a partido.
- Migrar de SQLite a Postgres, y de consultas SQL directas a un ORM
  (Prisma o Drizzle) si el equipo lo prefiere — hoy sostiene bien un piloto
  de un club, pero Postgres da más margen si se suman varios clubes.
- App mobile (React Native) con modo offline para carga en cancha (por
  ejemplo, cargar asistencia a entrenamientos desde el campo).
- Tests automatizados y CI/CD (hoy el control de calidad es manual, curl +
  Playwright, antes de cada entrega).
- Edición/borrado de cuentas y reseteo de contraseña desde Usuarios (hoy
  solo alta) y recuperación de contraseña por email para el club piloto.

## Estructura del proyecto

```
clubos-mvp/
  package.json    # orquesta install/build/start de backend + frontend (usado por Railway)
  DEPLOY.md        # guía de despliegue a producción (Railway)
  backend/
    src/
      db/            # conexión SQLite + funciones de acceso a datos
      middleware/    # autenticación (JWT) y control de acceso (requireModule/requireAdmin)
      permissions.ts # fuente única de verdad: qué sector lee/escribe cada rol
      bootstrap.ts   # crea el primer usuario Admin real desde variables de entorno (sin datos de ejemplo)
      routes/        # auth, players, scouting-reports, videos, training, stats, medical-records, physical-tests, users, dashboard, external (fuentes de datos), imports (planillas CSV)
      ingest/        # conectores de datos externos (statsbomb, apifootball), lector CSV y almacenamiento ext_*
      index.ts       # arranque del servidor (en producción también sirve el frontend compilado)
    sql/schema.sql   # modelo de datos
  frontend/
    src/
      pages/         # Login, Dashboard, Plantilla, DataAnalyst, Scouting, Video, Entrenamientos, FisicoMedico, FichaJugador, Usuarios, Fuentes, Importar
      permissions.ts # espejo del acceso por sector, solo para mostrar/ocultar en la UI (la seguridad real está en el backend)
      api.ts         # cliente HTTP tipado
      AuthContext.tsx
```
