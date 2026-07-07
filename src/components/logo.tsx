/** Logo de GymBros: mancuerna en diagonal sobre fondo oscuro redondeado. */
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
      <g transform="translate(256 256) rotate(-45)">
        <rect x="-120" y="-13" width="240" height="26" rx="13" fill="url(#gymbros-g)" />
        <rect x="-150" y="-66" width="34" height="132" rx="15" fill="url(#gymbros-g)" />
        <rect x="116" y="-66" width="34" height="132" rx="15" fill="url(#gymbros-g)" />
        <rect x="-108" y="-48" width="28" height="96" rx="13" fill="#22c55e" />
        <rect x="80" y="-48" width="28" height="96" rx="13" fill="#22c55e" />
      </g>
    </svg>
  );
}
