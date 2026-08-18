# Cómo revertir la reestructuración de grupos

Este documento acompaña al cambio que convierte GymBros de "un único grupo
global" a "varios grupos", y que añade el borrado de cuenta en dos fases.

## Punto de retorno

El estado anterior está etiquetado en git:

```
pre-grupos-v3.14   ->  commit 92ef408 (v3.14)
```

## Revertir el código

```bash
# Ver qué cambió respecto al estado anterior
git diff pre-grupos-v3.14 --stat

# Opción A (recomendada): un commit nuevo que deshace los cambios y
# conserva el historial
git revert --no-commit pre-grupos-v3.14..HEAD
git commit -m "Revertir la reestructuracion de grupos"

# Opción B: volver el árbol de trabajo exactamente al estado anterior
git checkout pre-grupos-v3.14 -- .
```

## Revertir la base de datos

Las tablas y columnas nuevas son **aditivas**: el código anterior las ignora,
así que revertir el código basta para volver a funcionar. Si además se quiere
dejar la base como estaba:

```sql
-- Quitar la pertenencia a grupos
DROP TABLE IF EXISTS "GroupMember";
DROP TABLE IF EXISTS "Group";
DROP TYPE IF EXISTS "GroupRole";

-- Quitar las columnas añadidas
ALTER TABLE "User" DROP COLUMN IF EXISTS "activeGroupId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "deletionRequestedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "deletionWord";
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "groupId";
ALTER TABLE "Poll" DROP COLUMN IF EXISTS "groupId";
```

Nada de esto borra usuarios, entrenos, rutinas, PRs ni medidas: todo eso es del
usuario y nunca dependió del grupo.

Ojo con una cosa: si mientras tanto se creó **más de un grupo**, al revertir
vuelven a verse todos los usuarios juntos en un único ranking y un único chat.

## Qué hay que ejecutar al desplegar (no antes de revisar)

```bash
npm run db:push              # crea tablas y columnas nuevas
npm run db:backfill-groups   # crea el grupo original y mete dentro a todos
```

El backfill es idempotente: crea el grupo con el código de `INVITE_CODE`, mete
en él a todos los usuarios existentes (los admins, como administradores del
grupo) y asigna a ese grupo el chat y las encuestas anteriores.

## Resumen de lo que cambia

| Ámbito | Antes | Ahora |
| --- | --- | --- |
| Grupos | Uno solo, por `INVITE_CODE` | Varios; se crean con la clave maestra `3333` |
| Ranking, chat, encuestas, feed, miembros | Toda la app | Solo el grupo activo |
| Rutinas, entrenos, PRs, medidas, puntos | Del usuario | Del usuario (sin cambios: los mismos en todos sus grupos) |
| Borrar cuenta | No existía | Dos fases: se oculta al instante, se elimina a los 15 días |
