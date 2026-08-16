import { GymLoader } from "@/components/gym-loader";

/**
 * Cargador de ruta. Aparece con retraso a propósito: en una navegación rápida
 * la pantalla nueva llega antes de que se haga visible, así que no se ve
 * ningún parpadeo. Solo se muestra cuando la carga tarda de verdad.
 */
export default function Loading() {
  return <GymLoader delayMs={250} />;
}
