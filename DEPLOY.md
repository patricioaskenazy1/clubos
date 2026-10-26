# Desplegar ClubOS para el piloto real en el club

Esta guía es para dejar ClubOS andando en una URL real, accesible desde
cualquier celular o notebook del club, sin depender de que una compu esté
prendida. Usa **Railway** porque tiene el camino más simple para este tipo
de app (Node + un archivo de base de datos que necesita persistir) y un
volumen persistente a precio accesible. Render es una alternativa, pero su
plan gratuito no sostiene un archivo que persista entre reinicios, así que
para este proyecto Railway sale más barato en la práctica (~US$5/mes en vez
de ~US$7/mes).

No hace falta terminal ni saber programar: son todos clicks en el
navegador. Vas a necesitar una cuenta de GitHub (si no tenés, se crea gratis
en el mismo flujo) y una tarjeta para Railway (cobra por uso, el plan chico
para esto ronda US$5/mes).

## 0. Qué es cada cosa

- **GitHub**: ahí vive una copia del código. Railway despliega leyendo de
  ahí, y cada vez que el código cambie, se puede volver a desplegar con un
  click (o automático).
- **Railway**: el servicio que efectivamente corre la plataforma 24/7 y te
  da una URL pública (`algo.up.railway.app`).
- **Volumen**: un disco que Railway mantiene entre reinicios, para que la
  base de datos (un archivo SQLite) no se borre cada vez que se reinicia el
  servicio.

## 1. Subir el código a GitHub

1. Andá a [github.com](https://github.com) y creá una cuenta si no tenés
   (botón "Sign up").
2. Creá un repositorio nuevo (botón verde "New"), nombre por ejemplo
   `clubos`, privado (para que no lo vea cualquiera) o público, como
   prefieras.
3. Subí el código de este proyecto a ese repositorio. Si nunca usaste git,
   la forma más simple es arrastrar los archivos desde la web de GitHub
   ("uploading an existing file") o pedirme que te pase los comandos exactos
   una vez que tengas el repo creado — dependiendo de dónde tengas el código
   en este momento, puede ser más simple que yo prepare el zip/carpeta lista
   para subir.

## 2. Crear el proyecto en Railway

1. Andá a [railway.app](https://railway.com) y entrá con "Login with
   GitHub" (así queda conectado directamente a tu cuenta de GitHub, sin
   pasos extra después).
2. "New Project" -> "Deploy from GitHub repo" -> elegí el repositorio que
   subiste.
3. Railway detecta solo que es un proyecto Node (por el `package.json` de
   la raíz) y corre automáticamente `npm install`, `npm run build` y
   `npm start` -- no hace falta tocar configuración de build.
4. **Importante**: dejá el "Root Directory" del servicio como está (la raíz
   del repo), no lo cambies a `backend/` ni `frontend/` -- el `package.json`
   de la raíz ya orquesta los dos.

## 3. Variables de entorno

En el servicio, pestaña **Variables**, agregá:

| Variable | Valor | Para qué |
| --- | --- | --- |
| `JWT_SECRET` | una frase larga y random, por ejemplo `correr-openssl-rand-hex-32-o-inventar-una-frase-larga-unica` | firma las sesiones de login |
| `ADMIN_EMAIL` | tu email real, por ejemplo `patricio@tuclub.com` | con qué entrás la primera vez |
| `ADMIN_PASSWORD` | una contraseña real, que después podés cambiar | tu contraseña inicial |
| `ADMIN_NAME` | tu nombre | como te va a mostrar la plataforma |
| `DATABASE_FILE` | `/app/data/clubos.db` | dónde vive el archivo de base de datos (ver paso 4, tiene que coincidir con el volumen) |
| `API_FOOTBALL_KEY` | (opcional) la clave gratuita de [api-football.com](https://www.api-football.com) | habilita traer calendario y resultados de ligas desde la pantalla **Fuentes**. Sin esta variable, esa fuente aparece como "Falta clave" y el resto funciona igual |

Después de agregar o cambiar variables, Railway muestra los cambios
pendientes: hay que apretar **Apply changes** y esperar el redeploy para
que tomen efecto.

Con `ADMIN_EMAIL`/`ADMIN_PASSWORD` configurados, la plataforma crea **un
solo usuario real** (vos, como Administrador) la primera vez que arranca --
sin jugadores ni datos de ejemplo, para que sea la base real del club. Desde
ahí entrás a la pantalla **Usuarios** y das de alta al resto (cuerpo
técnico, preparador físico, dirigencia, scouts) con sus emails y roles
reales.

## 4. Agregar el volumen (para que la base de datos no se borre)

En la versión actual de Railway no hay una sección "Volumes" dentro de
Settings: el volumen se agrega desde el lienzo del proyecto.

1. En el lienzo del proyecto, hacé **click derecho sobre la tarjeta del
   servicio** y elegí **Attach volume**.
2. Montalo en la ruta `/app/data`.
3. Confirmá que `DATABASE_FILE` (paso 3) sea `/app/data/clubos.db` -- así el
   archivo de la base de datos queda adentro del volumen y sobrevive a cada
   reinicio o redeploy.

Si el servicio se cae al arrancar con un error sobre `/app/data`, es que el
volumen todavía no está montado: adjuntalo y redesplegá.

## 5. Generar la URL pública

1. En el servicio, **Settings -> Networking -> Public Networking ->
   Generate Domain**.
2. Te da una URL gratis tipo `clubos-production.up.railway.app`. Esa es la
   que compartís con el cuerpo técnico, dirigencia, preparador físico y
   scouts -- entran desde el celu o la notebook, sin instalar nada.
3. Opcional, más adelante: se le puede poner un dominio propio (por ejemplo
   `plataforma.tuclub.com`) desde esa misma pantalla.

## 6. Primer ingreso

1. Abrí la URL, entrá con el `ADMIN_EMAIL`/`ADMIN_PASSWORD` que configuraste.
2. Andá a **Usuarios** y creá una cuenta para cada persona real: nombre,
   email, el sector que le corresponde (Cuerpo técnico, Preparador físico,
   Dirigencia, Scout) y una contraseña inicial que le pasás vos.
3. Empezá a cargar el plantel real desde **Gestión**. A partir de ahí, cada
   sector ve y carga solo lo suyo -- tal como lo definimos.

## Si te equivocaste con el email o la contraseña del administrador

El administrador inicial se crea **una sola vez**, la primera vez que la
base de datos está vacía. Si después corregís `ADMIN_EMAIL`, `ADMIN_PASSWORD`
o `ADMIN_NAME`, no pasa nada: el usuario ya existe con los valores viejos.
Mientras todavía no hayas cargado datos reales, la salida más simple es
borrar la base y dejar que se vuelva a crear:

1. Corregí las variables y aplicá los cambios.
2. En el servicio, abrí la pestaña **Console** y escribí a mano (no pegues,
   la consola inserta caracteres raros al pegar):
   `rm -f /app/data/clubos.db /app/data/clubos.db-wal /app/data/clubos.db-shm`
3. Reiniciá el servicio. Al arrancar con la base vacía, crea el
   administrador con los valores nuevos.

**Esto borra todos los datos**, así que solo sirve antes de cargar el
plantel real.

## Datos externos y planillas

- **Fuentes** (menú de arriba): trae datos de plataformas gratuitas. La base
  guarda de qué fuente vino cada dato, así se puede reimportar sin duplicar.
  StatsBomb Open Data no necesita clave; API-Football necesita la variable
  `API_FOOTBALL_KEY` (plan gratuito: 100 pedidos por día).
- **Importar** (menú de arriba): sube planillas de Excel o Google Sheets
  guardadas como CSV (plantel, estadísticas, tests físicos, partes
  médicos). Cada rol solo puede subir las planillas de su sector.

## Actualizar la plataforma más adelante

Cada vez que el código cambie (un módulo nuevo, un ajuste), basta con subir
el cambio al mismo repositorio de GitHub -- Railway lo redespliega solo. El
volumen con la base de datos no se toca en ese proceso, así que los datos
reales del club quedan intactos.
