"use client";

import { useEffect, useState } from "react";

const KEY = "gymbros-show-tutorial";
const EVENT = "gymbros-show-tutorial-change";

/** Permite relanzar el tutorial desde Ajustes. */
export function useTutorialLaunch(): [boolean, (value: boolean) => void] {
  const [launched, setState] = useState(false);

  useEffect(() => {
    const read = () => setState(sessionStorage.getItem(KEY) === "1");
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  const set = (value: boolean) => {
    sessionStorage.setItem(KEY, value ? "1" : "0");
    setState(value);
    window.dispatchEvent(new Event(EVENT));
  };

  return [launched, set];
}
