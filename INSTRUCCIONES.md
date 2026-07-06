# 🏋️ GymBros — Guía de puesta en marcha para principiantes

Sigue estos pasos en orden. No necesitas saber programar: solo copiar, pegar y hacer clic. Tiempo estimado: 20–30 minutos.

---

## PARTE 1 · Instalar Node.js (el motor de la app)

1. Ve a **https://nodejs.org** y descarga la versión **LTS** (el botón grande de la izquierda).
2. Ejecuta el instalador. Acepta todo con "Siguiente" (no cambies nada).
3. Comprueba que funciona: pulsa la tecla **Windows**, escribe `cmd`, abre el **Símbolo del sistema** y escribe:

   ```
   node --version
   ```

   Si aparece algo como `v22.x.x`, perfecto. Si da error, reinicia el ordenador y prueba de nuevo.

---

## PARTE 2 · Crear la base de datos en Supabase (gratis)

Aquí se guardarán los usuarios, entrenamientos, PRs, etc.

1. Entra en **https://supabase.com** → **Start your project** → regístrate (puedes usar tu cuenta de Google o GitHub).
2. Pulsa **New project**:
   - **Name:** `gymbros`
   - **Database Password:** inventa una contraseña y **GUÁRDALA en un bloc de notas** (la necesitarás en el paso siguiente).
   - **Region:** elige una de Europa (por ejemplo, `West EU (Ireland)`).
   - Pulsa **Create new project** y espera 1–2 minutos a que termine de crearse.
3. Consigue las dos direcciones de conexión:
   - Arriba del todo, pulsa el botón **Connect** (o ve a Project Settings → Database).
   - Busca la sección **Transaction pooler**: copia esa URL. Empieza por `postgresql://postgres.xxxx:...` y termina en `:6543/postgres`. Esta será tu **DATABASE_URL**.
   - Busca la sección **Session pooler** (o "Direct connection"): copia esa otra URL, que termina en `:5432/postgres`. Esta será tu **DIRECT_URL**.
   - En ambas URLs verás `[YOUR-PASSWORD]`: **sustitúyelo por la contraseña que guardaste** (sin corchetes).

---

## PARTE 3 · Configurar la app

1. Abre la carpeta del proyecto: `D:\Documentos - SSD\SCRIPTS\GYMBROS`
2. Verás un archivo llamado **`.env.example`**. Haz una copia y renómbrala a **`.env`** (solo punto-e-n-v, sin nada más).
   - Si Windows no te deja, abre el Bloc de notas, ve a Archivo → Abrir, selecciona `.env.example`, y luego Archivo → Guardar como → nombre: `.env` → tipo: "Todos los archivos".
3. Abre `.env` con el Bloc de notas y rellena cada línea:

   ```
   DATABASE_URL="pega aquí la URL del Transaction pooler (la del puerto 6543), añadiendo ?pgbouncer=true al final"
   DIRECT_URL="pega aquí la URL del puerto 5432"
   NEXTAUTH_SECRET="escribe aquí una frase larga aleatoria, ej: kj3h5k2j4h5kj23h45kjh234a8f7d6"
   NEXTAUTH_URL="http://localhost:3000"
   INVITE_CODE="GYMBROS2026"
   ```

   Detalles importantes:
   - `DATABASE_URL` debe terminar en `/postgres?pgbouncer=true`
   - `NEXTAUTH_SECRET` puede ser cualquier texto largo y aleatorio (aporrea el teclado 40 veces, vale).
   - `INVITE_CODE` es el código secreto que tus amigos escribirán para registrarse. Cámbialo por el que quieras.
   - Todo va **entre comillas dobles** y **sin espacios** alrededor del `=`.

4. Guarda el archivo y cierra.

---

## PARTE 4 · Instalar y arrancar

1. Abre el Símbolo del sistema **dentro de la carpeta del proyecto**: entra en `D:\Documentos - SSD\SCRIPTS\GYMBROS` con el Explorador, haz clic en la barra de direcciones, escribe `cmd` y pulsa Enter.
2. Ejecuta estos comandos **uno por uno**, esperando a que cada uno termine:

   ```
   npm install
   ```
   (Descarga las piezas de la app. Tarda 1–3 minutos. Los mensajes "warn" en amarillo son normales.)

   ```
   npm run db:push
   ```
   (Crea todas las tablas en tu base de datos de Supabase. Debe terminar diciendo "Your database is now in sync".)

   ```
   npm run db:seed
   ```
   (Carga el catálogo de ~65 ejercicios, las puntuaciones y los logros. Termina con "Seed completado ✅".)

   ```
   npm run dev
   ```
   (Arranca la app. Déjalo abierto: mientras esta ventana esté abierta, la app funciona.)

3. Abre el navegador y entra en **http://localhost:3000**
4. Pulsa **"Regístrate con tu código"**, usa tu `INVITE_CODE` y crea tu cuenta.

> ⭐ **El primer usuario que se registra se convierte automáticamente en ADMINISTRADOR.** Regístrate tú antes de compartir el código. Como admin verás la sección "Admin" en el menú para gestionar usuarios, cambiar las puntuaciones y enviar avisos al grupo.

Para apagar la app: en la ventana negra, pulsa `Ctrl + C`. Para volver a arrancarla otro día: abre `cmd` en la carpeta y ejecuta solo `npm run dev` (los demás comandos ya no hacen falta).

---

## PARTE 5 · Publicarla en internet con Vercel (gratis) — para que tus amigos entren desde el móvil

En local (`localhost`) solo tú puedes usarla. Para que el grupo entre desde cualquier sitio:

### 5.1 Subir el proyecto a GitHub

1. Crea una cuenta en **https://github.com**
2. Descarga e instala **GitHub Desktop**: https://desktop.github.com
3. En GitHub Desktop: **File → Add local repository** → elige `D:\Documentos - SSD\SCRIPTS\GYMBROS`. Si te dice que no es un repositorio, pulsa la opción de **"create a repository"** que te ofrece.
4. Escribe un mensaje cualquiera abajo a la izquierda (ej. "primera versión") → **Commit to main**.
5. Pulsa **Publish repository** arriba → marca la casilla **"Keep this code private"** → **Publish**.

> El archivo `.env` con tus contraseñas NO se sube (está protegido por `.gitignore`). Es lo correcto: las claves se pondrán en Vercel a mano.

### 5.2 Desplegar en Vercel

1. Entra en **https://vercel.com** → **Sign up** → elige **Continue with GitHub**.
2. Pulsa **Add New… → Project** → busca `GYMBROS` → **Import**.
3. Antes de darle a Deploy, abre la sección **Environment Variables** y añade estas 5 variables, una a una (nombre a la izquierda, valor a la derecha):

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | la misma del `.env` |
   | `DIRECT_URL` | la misma del `.env` |
   | `NEXTAUTH_SECRET` | el mismo del `.env` |
   | `NEXTAUTH_URL` | déjala de momento como `https://gymbros.vercel.app` (la corregirás en el paso 5) |
   | `INVITE_CODE` | tu código de invitación |

4. Pulsa **Deploy** y espera 2–3 minutos.
5. Vercel te dará la dirección real (algo como `https://gymbros-abc123.vercel.app`). Ve a **Settings → Environment Variables**, edita `NEXTAUTH_URL` y pon esa dirección exacta. Luego ve a **Deployments** → menú `⋯` del último → **Redeploy**.
6. ¡Listo! Comparte con tus amigos la dirección y el código de invitación.

> 📱 **Truco móvil:** al abrir la web en el móvil, usad "Añadir a pantalla de inicio" en el menú del navegador. Se instalará como si fuera una app.

### Actualizaciones futuras

Cuando cambies algo del código: abre GitHub Desktop → Commit → **Push origin**. Vercel detecta el cambio y republica solo.

---

## Problemas frecuentes

**"npm no se reconoce como un comando"** → Node.js no está instalado o falta reiniciar el ordenador tras instalarlo.

**`db:push` falla con error de conexión** → Revisa el `.env`: contraseña correcta (sin `[` `]`), URL completa, y que `DATABASE_URL` use el puerto **6543** con `?pgbouncer=true` y `DIRECT_URL` el **5432**.

**"Código de invitación incorrecto" al registrarse** → Debe coincidir EXACTAMENTE con el `INVITE_CODE` del `.env` (mayúsculas incluidas). Si lo cambias, reinicia la app (`Ctrl+C` y `npm run dev`).

**La página se queda en blanco o da error tras iniciar sesión** → Suele ser `NEXTAUTH_SECRET` vacío o `NEXTAUTH_URL` mal puesta. Revisa el `.env` y reinicia.

**Supabase pausa el proyecto** → El plan gratuito pausa la base de datos tras ~1 semana sin uso. Entra en supabase.com y pulsa "Restore". Si la usáis a diario, no pasará.

**Quiero cambiar el código de invitación** → Edita `INVITE_CODE` en el `.env` (local) y en Vercel → Settings → Environment Variables (producción) + Redeploy.
