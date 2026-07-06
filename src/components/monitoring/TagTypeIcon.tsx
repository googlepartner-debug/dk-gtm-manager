// Logo-based icons per tag category.
// Official logos are served from /tag-types/ (public folder).
// Falls back to SVG initials for categories without a logo file.

interface Props {
  category: string;
  size?: number;
}

// Categories that have a real logo in public/tag-types/
const LOGO_MAP: Record<string, string> = {
  'GA4':        '/tag-types/ga4.svg',
  'Google Ads': '/tag-types/google-ads.svg',
  'Floodlight': '/tag-types/floodlight.svg',
  'Piano':      '/tag-types/piano.png',
  'Matomo':     '/tag-types/matomo.png',
  'LinkedIn':   '/tag-types/linkedin.png',
  'Microsoft':  '/tag-types/microsoft.png',
  'HTML Custom':'/tag-types/custom.svg',
};

// Fallback: colored circle with initials
const FALLBACK_CONFIG: Record<string, { bg: string; label: string }> = {
  'Kameleoon':  { bg: '#6B3FA0', label: 'K' },
  'AB Tasty':   { bg: '#E91E63', label: 'AB' },
  'Meta Pixel': { bg: '#1877F2', label: 'f' },
  'TikTok':     { bg: '#010101', label: 'TT' },
  'Hotjar':     { bg: '#FD3A5C', label: 'H' },
};

export function TagTypeIcon({ category, size = 20 }: Props) {
  const logo = LOGO_MAP[category];

  if (logo) {
    return (
      <img
        src={logo}
        alt={category}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
        draggable={false}
      />
    );
  }

  const fallback = FALLBACK_CONFIG[category];
  const bg = fallback?.bg ?? '#607D8B';
  const label = fallback?.label ?? category.slice(0, 2).toUpperCase();
  const r = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <circle cx={r} cy={r} r={r} fill={bg} />
      <text
        x={r}
        y={r * 1.38}
        textAnchor="middle"
        fill="white"
        fontSize={size * (label.length > 1 ? 0.38 : 0.55)}
        fontWeight="700"
        fontFamily="sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
