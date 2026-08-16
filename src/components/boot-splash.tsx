/**
 * Pantalla de carga animada, renderizada en el HTML inicial.
 *
 * En Android, la pantalla que dibuja Chrome al abrir la PWA (fondo del
 * manifiesto + icono + nombre) se mantiene hasta el primer pintado de la
 * página. Como este bloque llega ya en el HTML —sin esperar a React— la
 * animación aparece justo en ese primer pintado y el relevo es inmediato.
 *
 * No lleva JavaScript: la propia animación CSS la retira al terminar. Solo se
 * muestra con la app instalada; en el navegador se encarga <AppSplash>.
 */
export function BootSplash() {
  return (
    <>
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
#gb-boot {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0a0a0b;
  animation: gb-boot-out 0.5s ease-in 1.4s forwards;
}
/* Solo en la app instalada: en el navegador la muestra <AppSplash> */
@media all and (display-mode: standalone) {
  #gb-boot { display: flex; }
}
@media all and (display-mode: fullscreen) {
  #gb-boot { display: flex; }
}
@keyframes gb-boot-out {
  to { opacity: 0; visibility: hidden; pointer-events: none; transform: scale(1.04); }
}
#gb-boot .gb-halo {
  position: absolute;
  height: 18rem;
  width: 18rem;
  border-radius: 9999px;
  background: rgba(34, 197, 94, 0.2);
  filter: blur(70px);
  animation: gb-boot-halo 2s ease-in-out infinite;
}
@keyframes gb-boot-halo {
  0%, 100% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}
/* El logo ya está a tamaño final en el primer frame: así encaja con el icono
   que venía mostrando el sistema y no se percibe ningún salto. */
#gb-boot .gb-mark {
  position: relative;
  height: 7rem;
  width: 7rem;
  filter: drop-shadow(0 0 28px rgba(34, 197, 94, 0.45));
  animation: gb-boot-mark 1.6s ease-in-out infinite;
}
@keyframes gb-boot-mark {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
#gb-boot .gb-name {
  position: relative;
  margin-top: 1.5rem;
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #fafafa;
  animation: gb-boot-rise 0.6s ease-out 0.15s both;
}
#gb-boot .gb-name span { color: #22c55e; }
#gb-boot .gb-tagline {
  position: relative;
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #8e8e99;
  animation: gb-boot-rise 0.6s ease-out 0.3s both;
}
@keyframes gb-boot-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
#gb-boot .gb-bar {
  position: relative;
  margin-top: 2rem;
  height: 4px;
  width: 8rem;
  overflow: hidden;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
  animation: gb-boot-rise 0.6s ease-out 0.4s both;
}
#gb-boot .gb-bar > span {
  display: block;
  height: 100%;
  width: 100%;
  border-radius: 9999px;
  background: #22c55e;
  transform-origin: left;
  animation: gb-boot-load 1.2s ease-in-out 0.4s both;
}
@keyframes gb-boot-load {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@media (prefers-reduced-motion: reduce) {
  #gb-boot .gb-halo,
  #gb-boot .gb-mark,
  #gb-boot .gb-name,
  #gb-boot .gb-tagline,
  #gb-boot .gb-bar,
  #gb-boot .gb-bar > span { animation: none; }
}
`,
        }}
      />
      <div id="gb-boot" aria-hidden="true">
        <div className="gb-halo" />
        <svg className="gb-mark" viewBox="0 0 512 512">
          <circle cx="256" cy="256" r="170" fill="#16a34a" />
          <circle cx="256" cy="256" r="118" fill="#0a0a0b" />
          <circle cx="256" cy="256" r="96" fill="#22c55e" />
          <circle cx="256" cy="256" r="34" fill="#0a0a0b" />
        </svg>
        <p className="gb-name">
          Gym<span>Bros</span>
        </p>
        <p className="gb-tagline">Entrena. Compite. Progresa.</p>
        <div className="gb-bar">
          <span />
        </div>
      </div>
    </>
  );
}
