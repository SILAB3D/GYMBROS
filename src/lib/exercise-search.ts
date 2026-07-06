/**
 * Búsqueda de ejercicios con soporte bilingüe: cada ejercicio del catálogo
 * tiene alias en inglés para que "bench press" encuentre "Press banca".
 */

const ALIASES: Record<string, string[]> = {
  // Pecho
  "Press banca": ["bench press", "flat bench"],
  "Press banca inclinado": ["incline bench press"],
  "Press banca declinado": ["decline bench press"],
  "Press banca con mancuernas": ["dumbbell bench press", "db bench"],
  "Aperturas con mancuernas": ["dumbbell fly", "chest fly", "flyes"],
  "Cruce de poleas": ["cable crossover", "cable fly"],
  "Fondos en paralelas": ["dips", "chest dips"],
  "Press en máquina": ["machine chest press"],
  "Flexiones": ["push ups", "pushups", "press ups"],
  // Espalda
  "Peso muerto": ["deadlift", "conventional deadlift"],
  "Dominadas": ["pull ups", "pullups", "chin ups"],
  "Dominadas lastradas": ["weighted pull ups"],
  "Remo con barra": ["barbell row", "bent over row"],
  "Remo con mancuerna": ["dumbbell row", "one arm row"],
  "Jalón al pecho": ["lat pulldown", "pulldown"],
  "Remo en polea baja": ["seated cable row", "low row"],
  "Pullover en polea": ["cable pullover", "straight arm pulldown"],
  "Remo en máquina": ["machine row"],
  "Hiperextensiones": ["back extension", "hyperextension"],
  // Hombro
  "Press militar": ["overhead press", "military press", "ohp"],
  "Press militar con mancuernas": ["dumbbell shoulder press"],
  "Elevaciones laterales": ["lateral raise", "side raise"],
  "Elevaciones frontales": ["front raise"],
  "Pájaros": ["reverse fly", "rear delt fly"],
  "Face pull": ["face pull"],
  "Press Arnold": ["arnold press"],
  "Encogimientos con barra": ["shrugs", "barbell shrug"],
  // Bíceps
  "Curl con barra": ["barbell curl"],
  "Curl con barra Z": ["ez bar curl"],
  "Curl con mancuernas": ["dumbbell curl"],
  "Curl martillo": ["hammer curl"],
  "Curl en banco Scott": ["preacher curl"],
  "Curl en polea": ["cable curl"],
  "Curl concentrado": ["concentration curl"],
  // Tríceps
  "Press francés": ["skull crusher", "french press", "lying triceps extension"],
  "Extensión de tríceps en polea": ["triceps pushdown", "cable pushdown"],
  "Extensión con cuerda": ["rope pushdown", "rope extension"],
  "Press cerrado": ["close grip bench press"],
  "Fondos entre bancos": ["bench dips"],
  "Patada de tríceps": ["triceps kickback"],
  // Pierna
  "Sentadilla": ["squat", "back squat"],
  "Sentadilla frontal": ["front squat"],
  "Prensa de piernas": ["leg press"],
  "Zancadas": ["lunges", "walking lunges"],
  "Extensión de cuádriceps": ["leg extension", "quad extension"],
  "Curl femoral": ["leg curl", "hamstring curl"],
  "Peso muerto rumano": ["romanian deadlift", "rdl"],
  "Sentadilla búlgara": ["bulgarian split squat"],
  "Elevación de gemelos": ["calf raise"],
  "Sentadilla hack": ["hack squat"],
  "Aductores en máquina": ["adductor machine", "hip adduction"],
  // Glúteo
  "Hip thrust": ["hip thrust"],
  "Patada de glúteo en polea": ["glute kickback", "cable kickback"],
  "Abductores en máquina": ["abductor machine", "hip abduction"],
  "Puente de glúteos": ["glute bridge"],
  // Core
  "Plancha": ["plank"],
  "Crunch abdominal": ["crunch", "sit ups", "situps"],
  "Elevación de piernas": ["leg raise", "hanging leg raise"],
  "Rueda abdominal": ["ab wheel", "ab rollout"],
  "Russian twist": ["russian twist"],
  "Crunch en polea": ["cable crunch"],
  // Cardio
  "Cinta de correr": ["treadmill", "running"],
  "Bicicleta estática": ["stationary bike", "cycling", "spinning"],
  "Elíptica": ["elliptical"],
  "Remo (máquina)": ["rowing machine", "rower", "erg"],
  "Comba": ["jump rope", "skipping"],
  "Escaladora": ["stair climber", "stairmaster"],
};

/** Minúsculas y sin tildes, para comparar. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** ¿El ejercicio (por nombre) coincide con la búsqueda, en español o inglés? */
export function matchesExercise(exerciseName: string, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  if (normalize(exerciseName).includes(q)) return true;
  const aliases = ALIASES[exerciseName] ?? [];
  return aliases.some((alias) => normalize(alias).includes(q));
}
