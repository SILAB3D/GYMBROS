import type { PrismaClient, MuscleGroup } from "@prisma/client";

/**
 * Afinidad de entrenamiento entre dos miembros del grupo.
 *
 * Se compara cómo entrena cada uno a partir de sus rutinas, en tres bloques:
 *   1. Frecuencia  — entrenamientos programados por semana.
 *   2. Volumen     — ejercicios y series totales de una rutina media.
 *   3. Músculos    — reparto de los ejercicios entre grupos musculares.
 *
 * Cada bloque da una similitud de 0 a 1 y se combina con estos pesos: el
 * reparto muscular es lo que más define un estilo de entrenamiento, la
 * frecuencia marca el ritmo y el volumen afina el parecido.
 */
export const AFFINITY_WEIGHTS = { muscles: 0.5, frequency: 0.3, volume: 0.2 } as const;

export type AffinityProfile = {
  /** Entrenamientos planificados por semana (suma de «veces por semana»). */
  weekly: number;
  /** Ejercicios de una rutina media. */
  avgExercises: number;
  /** Series totales de una rutina media. */
  avgSets: number;
  /** Reparto de ejercicios por grupo muscular (proporciones que suman 1). */
  distribution: Partial<Record<MuscleGroup, number>>;
  /** Grupo muscular con más peso en sus rutinas. */
  topMuscle: MuscleGroup | null;
  /** Rutinas con al menos un ejercicio. */
  routines: number;
};

export type AffinityBreakdown = {
  total: number; // 0-100
  frequency: number; // 0-100
  volume: number; // 0-100
  muscles: number; // 0-100
};

/** Similitud entre dos magnitudes: 1 si son iguales, 0 si no se parecen nada. */
function ratioSimilarity(a: number, b: number): number {
  const max = Math.max(a, b);
  if (max <= 0) return 1; // ninguno de los dos entrena eso: no hay discrepancia
  return 1 - Math.abs(a - b) / max;
}

/**
 * Solape entre dos repartos: suma de la parte común de cada grupo muscular.
 * Con repartos idénticos vale 1; sin ningún grupo en común, 0.
 */
function distributionOverlap(
  a: Partial<Record<MuscleGroup, number>>,
  b: Partial<Record<MuscleGroup, number>>,
): number {
  const groups = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<MuscleGroup>;
  let overlap = 0;
  groups.forEach((g) => {
    overlap += Math.min(a[g] ?? 0, b[g] ?? 0);
  });
  return overlap;
}

/** Perfil de entrenamiento de cada usuario, a partir de sus rutinas. */
export async function trainingProfiles(db: PrismaClient): Promise<Map<string, AffinityProfile>> {
  const routines = await db.routine.findMany({
    select: {
      userId: true,
      timesPerWeek: true,
      inPlan: true,
      exercises: { select: { sets: true, exercise: { select: { muscleGroup: true } } } },
    },
  });

  const profiles = new Map<string, AffinityProfile>();
  const counters = new Map<
    string,
    { weekly: number; routines: number; exercises: number; sets: number; byMuscle: Map<MuscleGroup, number> }
  >();

  for (const r of routines) {
    const c =
      counters.get(r.userId) ??
      { weekly: 0, routines: 0, exercises: 0, sets: 0, byMuscle: new Map<MuscleGroup, number>() };
    if (r.inPlan) c.weekly += r.timesPerWeek;
    if (r.exercises.length > 0) {
      c.routines += 1;
      c.exercises += r.exercises.length;
      for (const e of r.exercises) {
        c.sets += e.sets;
        const g = e.exercise.muscleGroup;
        c.byMuscle.set(g, (c.byMuscle.get(g) ?? 0) + 1);
      }
    }
    counters.set(r.userId, c);
  }

  counters.forEach((c, userId) => {
    const distribution: Partial<Record<MuscleGroup, number>> = {};
    let topMuscle: MuscleGroup | null = null;
    let topCount = 0;
    c.byMuscle.forEach((count, group) => {
      distribution[group] = c.exercises > 0 ? count / c.exercises : 0;
      if (count > topCount) {
        topCount = count;
        topMuscle = group;
      }
    });
    profiles.set(userId, {
      // El plan no puede pasar de 7 días, igual que en weeklyTargetDays
      weekly: Math.min(7, c.weekly),
      avgExercises: c.routines > 0 ? c.exercises / c.routines : 0,
      avgSets: c.routines > 0 ? c.sets / c.routines : 0,
      distribution,
      topMuscle,
      routines: c.routines,
    });
  });

  return profiles;
}

/**
 * Afinidad entre dos perfiles. Devuelve null si alguno no tiene rutinas con
 * ejercicios: sin datos no hay nada que comparar.
 */
export function affinityBetween(
  a: AffinityProfile | undefined,
  b: AffinityProfile | undefined,
): AffinityBreakdown | null {
  if (!a || !b || a.routines === 0 || b.routines === 0) return null;

  const frequency = ratioSimilarity(a.weekly, b.weekly);
  // El volumen mezcla las dos caras del tamaño de una rutina: cuántos
  // ejercicios tiene y cuántas series suma en total.
  const volume =
    (ratioSimilarity(a.avgExercises, b.avgExercises) + ratioSimilarity(a.avgSets, b.avgSets)) / 2;
  const muscles = distributionOverlap(a.distribution, b.distribution);

  const total =
    frequency * AFFINITY_WEIGHTS.frequency +
    volume * AFFINITY_WEIGHTS.volume +
    muscles * AFFINITY_WEIGHTS.muscles;

  const pct = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100);
  return {
    total: pct(total),
    frequency: pct(frequency),
    volume: pct(volume),
    muscles: pct(muscles),
  };
}

export type AffinityDetail = {
  frequency: { mine: number; theirs: number };
  exercises: { mine: number; theirs: number };
  sets: { mine: number; theirs: number };
  /** Grupos musculares donde más se separan los dos repartos (en puntos %). */
  muscles: Array<{ group: MuscleGroup; mine: number; theirs: number; gap: number }>;
};

/**
 * Datos crudos de la comparación, para poder explicar en qué se diferencian
 * dos formas de entrenar en lugar de soltar solo un porcentaje.
 */
export function affinityDetail(
  a: AffinityProfile | undefined,
  b: AffinityProfile | undefined,
): AffinityDetail | null {
  if (!a || !b || a.routines === 0 || b.routines === 0) return null;

  const round = (n: number) => Math.round(n * 10) / 10;
  const groups = new Set([
    ...Object.keys(a.distribution),
    ...Object.keys(b.distribution),
  ]) as Set<MuscleGroup>;

  const muscles = Array.from(groups)
    .map((group) => {
      const mine = Math.round((a.distribution[group] ?? 0) * 100);
      const theirs = Math.round((b.distribution[group] ?? 0) * 100);
      return { group, mine, theirs, gap: mine - theirs };
    })
    .filter((m) => Math.abs(m.gap) >= 5) // por debajo de 5 puntos no es diferencia
    .sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap))
    .slice(0, 3);

  return {
    frequency: { mine: a.weekly, theirs: b.weekly },
    exercises: { mine: round(a.avgExercises), theirs: round(b.avgExercises) },
    sets: { mine: round(a.avgSets), theirs: round(b.avgSets) },
    muscles,
  };
}
