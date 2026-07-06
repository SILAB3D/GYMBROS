export { default } from "next-auth/middleware";

// Protege toda la app excepto login, registro y rutas públicas
export const config = {
  matcher: ["/((?!api|login|registro|_next/static|_next/image|favicon.ico).*)"],
};
