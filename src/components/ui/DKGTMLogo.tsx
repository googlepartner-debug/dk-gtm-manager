interface Props {
  variant?: 'dark' | 'light'; // dark = sur fond sombre, light = sur fond clair
  size?: 'sm' | 'md' | 'lg';
  showProduct?: boolean; // afficher "GTM Manager" ou juste "DK GTM"
}

const sizes = {
  sm: { dk: 22, gtm: 14, sub: 9, gap: 4 },
  md: { dk: 32, gtm: 20, sub: 11, gap: 6 },
  lg: { dk: 52, gtm: 32, sub: 14, gap: 8 },
};

export function DKGTMLogo({ variant = 'dark', size = 'md', showProduct = true }: Props) {
  const s = sizes[size];
  const textColor = variant === 'dark' ? '#ffffff' : '#000a06';
  const subColor = variant === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,10,6,0.4)';

  return (
    <svg
      viewBox={`0 0 ${s.dk * 2.5 + s.gap + s.gtm * 3.8} ${s.dk * 1.3}`}
      height={s.dk * 1.3}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DK GTM Manager"
      style={{ display: 'block' }}
    >
      {/* DK — brand mark in purple */}
      <text
        x="0"
        y={s.dk}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize={s.dk}
        fontWeight="900"
        fill="#9031ff"
        letterSpacing="-0.03em"
      >
        DK
      </text>

      {/* GTM — product identifier in white/dark */}
      <text
        x={s.dk * 2.5 + s.gap}
        y={s.dk}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize={s.gtm}
        fontWeight="800"
        fill={textColor}
        letterSpacing="-0.02em"
        dominantBaseline="auto"
      >
        GTM
      </text>

      {/* Manager — subtitle */}
      {showProduct && (
        <text
          x={s.dk * 2.5 + s.gap}
          y={s.dk * 1.25}
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize={s.sub}
          fontWeight="600"
          fill={subColor}
          letterSpacing="0.08em"
          textAnchor="start"
          dominantBaseline="auto"
        >
          MANAGER
        </text>
      )}
    </svg>
  );
}

// Version inline SVG pour export img src (base64)
export const DK_GTM_LOGO_DARK_SVG = `<svg viewBox="0 0 220 56" height="56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="44" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="52" font-weight="900" fill="#9031ff" letter-spacing="-0.03em">DK</text>
  <text x="136" y="44" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="32" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">GTM</text>
  <text x="136" y="56" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="10" font-weight="600" fill="rgba(255,255,255,0.4)" letter-spacing="0.08em">MANAGER</text>
</svg>`;
