export { default } from "next-auth/middleware";

// Protege toda la app excepto login, registro, recuperación de contraseña y
// los archivos públicos (iconos, manifiesto, service worker y el sonido del
// temporizador, que el propio service worker precarga y debe poder descargar
// sin sesión).
export const config = {
  matcher: [
    "/((?!api|login|registro|recuperar|_next/static|_next/image|favicon.ico|manifest.json|sw.js|splash|.*\\.(?:png|svg|ico|webp|wav|mp3|json)$).*)",
  ],
};
