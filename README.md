# 🏋️ GymBros

Aplicación web privada para un grupo de amigos que entrenan en el gimnasio: rutinas, entrenamientos, asistencia con rachas, PRs con detección automática, ranking por puntos, objetivos, medidas privadas y panel de administración.

**Stack:** Next.js 14 (App Router) · TypeScript estricto · Tailwind CSS · tRPC · Prisma · PostgreSQL (Supabase) · NextAuth · Recharts · Framer Motion.

---

## Puesta en marcha (15 minutos)

### 1. Crear la base de datos en Supabase (gratis)

1. Entra en [supabase.com](https://supabase.com) → **New project**. Guarda la contraseña de la base de datos.
2. En **Project Settings → Database → Connection string** copia las dos URLs:
   - **Transaction pooler** (puerto `6543`) → será `DATABASE_URL` (añade `?pgbouncer=true` al final)
   - **Session / directa** (puerto `5432`) → será `DIRECT_URL`

### 2. Configurar el proyecto en local

```bash
npm install
cp .env.example .env
# Edita .env con tus URLs de Supabase, un NEXTAUTH_SECRET y tu INVITE_CODE
```

Genera el secreto: `openssl rand -base64 32`

### 3. Crear las tablas y el catálogo de ejercicios

```bash
npm run db:push   # crea todas las tablas en Supabase
npm run db:seed   # carga ~65 ejercicios, puntuaciones y logros
```

### 4. Arrancar

```bash
npm run dev
```

Abre http://localhost:3000, regístrate con tu `INVITE_CODE`. **El primer usuario registrado es automáticamente ADMIN.**

---

## Desplegar en Vercel (gratis)

1. Sube el proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo.
3. En **Environment Variables** añade: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (tu dominio, ej. `https://gymbros.vercel.app`) e `INVITE_CODE`.
4. Deploy. Listo: comparte la URL y el código de invitación con tus amigos.

---

## Cómo funciona

### Sistema de puntos (configurable desde /admin)

| Acción | Puntos |
|---|---|
| Ir al gimnasio | +10 |
| Completar rutina | +15 |
| Nuevo PR | +30 |
| Racha de 7 días | +50 |
| Compartir rutina | +10 |
| Cumplir objetivo | +40 |

El ranking (semanal/mensual/anual) se calcula agregando los eventos de puntos por periodo, con variación respecto al periodo anterior, medallas y podio animado.

### Detección automática de PRs
Al terminar un entrenamiento se compara el mejor peso completado de cada ejercicio con tu histórico. Si lo superas: PR automático, +30 puntos, notificación al grupo y entrada en el feed.

### Rachas
Se calculan sobre las asistencias con días consecutivos. Cada múltiplo de 7 días da bonus. Se guarda la mejor racha histórica.

### Privacidad
La sección **Medidas** (peso corporal, % grasa, medidas, notas) es estrictamente privada: la API nunca acepta consultar métricas de otro usuario y el perfil público solo expone asistencias, PRs, rachas, objetivos públicos y rutinas compartidas.

### Roles
- `USER`: uso normal.
- `ADMIN` (el primer registro, o asignado desde /admin): gestionar usuarios, configurar puntuaciones, borrar contenido y enviar notificaciones a todo el grupo.

---

## Estructura

```
prisma/schema.prisma      Esquema completo (incluye modelos de fases futuras)
prisma/seed.ts            Catálogo de ejercicios, puntos y logros
src/server/auth.ts        NextAuth (credenciales + JWT)
src/server/api/routers/   Un router tRPC por módulo (14 módulos)
src/server/services/      Gamificación: puntos, logros, feed, notificaciones
src/app/(auth)/           Login y registro con código de invitación
src/app/(app)/            Páginas de la aplicación (panel, rutinas, entrenar…)
src/components/           Componentes reutilizables (ui, nav, calendario, forms)
```

## Preparado para el futuro

El esquema ya incluye los modelos de **feed social con likes/comentarios** (router `feed` implementado), **logros** (se otorgan automáticamente; falta solo la pantalla de colección) y campos para **fotos de progreso**. Roadmap sugerido: pantalla de feed y logros → subida de imágenes a Supabase Storage → recuperación de contraseña por email (Resend) → PWA → QR de entrada, wearables, desafíos, ligas, IA de rutinas.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo |
| `npm run build` | Build de producción |
| `npm run db:push` | Sincronizar esquema con la BD |
| `npm run db:seed` | Datos iniciales |
