"use client";

import { useEffect, useState } from "react";

const KEY = "gymbros-view-as-user";
const EVENT = "gymbros-view-as-user-change";

/** El admin puede ver la app como un usuario estándar (solo afecta a este dispositivo). */
export function useViewAsUser(): [boolean, (value: boolean) => void] {
  const [viewAsUser, setState] = useState(false);

  useEffect(() => {
    const read = () => setState(localStorage.getItem(KEY) === "1");
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  const set = (value: boolean) => {
    localStorage.setItem(KEY, value ? "1" : "0");
    setState(value);
    window.dispatchEvent(new Event(EVENT));
  };

  return [viewAsUser, set];
}
