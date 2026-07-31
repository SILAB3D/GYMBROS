import { addMonths, differenceInCalendarDays } from "date-fns";

/** La primera temporada empieza el 15 de agosto de 2026; cada una dura 3 meses. */
export const SEASON_ANCHOR = new Date(2026, 7, 15); // mes 7 = agosto
export const SEASON_MONTHS = 3;

export type SeasonInfo = {
  index: number; // 1, 2, 3… (0 = antes de que empiece la primera)
  from: Date;
  to: Date;
  started: boolean;
  daysLeft: number;
};

/** Devuelve la temporada correspondiente a una fecha (o la cuenta atrás si aún no empezó). */
export function seasonAt(date = new Date()): SeasonInfo {
  if (date < SEASON_ANCHOR) {
    return {
      index: 0,
      from: SEASON_ANCHOR,
      to: addMonths(SEASON_ANCHOR, SEASON_MONTHS),
      started: false,
      daysLeft: differenceInCalendarDays(SEASON_ANCHOR, date),
    };
  }
  let index = 1;
  let from = SEASON_ANCHOR;
  let to = addMonths(from, SEASON_MONTHS);
  while (date >= to) {
    from = to;
    to = addMonths(from, SEASON_MONTHS);
    index += 1;
  }
  return { index, from, to, started: true, daysLeft: differenceInCalendarDays(to, date) };
}

/** Rango de la temporada N (1-indexado). */
export function seasonRange(index: number): { from: Date; to: Date } {
  const from = addMonths(SEASON_ANCHOR, (index - 1) * SEASON_MONTHS);
  return { from, to: addMonths(from, SEASON_MONTHS) };
}
