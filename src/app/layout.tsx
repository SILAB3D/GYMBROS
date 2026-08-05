import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GymBros", template: "%s · GymBros" },
  description: "Entrena, compite y progresa con tu grupo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymBros",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

/**
 * Pantallas de inicio de iOS: cada una se aplica según el tamaño y la
 * densidad del dispositivo (ancho/alto en puntos CSS, no en píxeles).
 */
const IOS_SPLASH: Array<{ file: string; w: number; h: number; ratio: number }> = [
  { file: "iphone-15-max", w: 430, h: 932, ratio: 3 },
  { file: "iphone-15", w: 393, h: 852, ratio: 3 },
  { file: "iphone-max", w: 428, h: 926, ratio: 3 },
  { file: "iphone-13-14", w: 390, h: 844, ratio: 3 },
  { file: "iphone-x", w: 375, h: 812, ratio: 3 },
  { file: "iphone-xr", w: 414, h: 896, ratio: 2 },
  { file: "iphone-8", w: 375, h: 667, ratio: 2 },
  { file: "ipad", w: 768, h: 1024, ratio: 2 },
  { file: "ipad-pro11", w: 834, h: 1194, ratio: 2 },
  { file: "ipad-pro12", w: 1024, h: 1366, ratio: 2 },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        {IOS_SPLASH.map((s) => (
          <link
            key={s.file}
            rel="apple-touch-startup-image"
            href={`/splash/${s.file}.png`}
            media={`(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.ratio})`}
          />
        ))}
      </head>
      <body className="font-sans min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
