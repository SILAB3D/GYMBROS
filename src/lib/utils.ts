import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKg(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
}

export const MUSCLE_LABELS: Record<string, string> = {
  PECHO: "Pecho",
  ESPALDA: "Espalda",
  HOMBRO: "Hombro",
  BICEPS: "Bíceps",
  TRICEPS: "Tríceps",
  PIERNA: "Pierna",
  GLUTEO: "Glúteo",
  CORE: "Core",
  CARDIO: "Cardio",
  OTRO: "Otro",
};

export const DAY_LABELS = ["D", "L", "M", "X", "J", "V", "S"];
