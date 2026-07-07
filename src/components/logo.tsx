/** Logo de GymBros: disco de pesas con degradado verde sobre fondo oscuro redondeado. */
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
      <defs>
        <linearGradient id="gymbros-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="115" fill="#0a0a0b" />
      <circle cx="256" cy="256" r="170" fill="url(#gymbros-g)" />
      <circle cx="256" cy="256" r="118" fill="#0a0a0b" />
      <circle cx="256" cy="256" r="96" fill="url(#gymbros-g)" />
      <circle cx="256" cy="256" r="34" fill="#0a0a0b" />
    </svg>
  );
}
