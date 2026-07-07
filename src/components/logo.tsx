/** Logo de GymBros: disco de pesas verde sobre fondo oscuro redondeado. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="512" height="512" rx="115" fill="#0a0a0b" />
      <circle cx="256" cy="256" r="170" fill="#16a34a" />
      <circle cx="256" cy="256" r="118" fill="#0a0a0b" />
      <circle cx="256" cy="256" r="96" fill="#22c55e" />
      <circle cx="256" cy="256" r="34" fill="#0a0a0b" />
    </svg>
  );
}
