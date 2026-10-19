import React from 'react';

interface IAFEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showMotto?: boolean;
  className?: string;
  withPulsingRadar?: boolean;
}

export const IAFEmblem: React.FC<IAFEmblemProps> = ({
  size = 'lg',
  showMotto = true,
  className = '',
  withPulsingRadar = true,
}) => {
  const sizeMap = {
    sm: { container: 'w-20 h-20', svg: 'w-16 h-16', ring: 'w-20 h-20' },
    md: { container: 'w-32 h-32', svg: 'w-28 h-28', ring: 'w-32 h-32' },
    lg: { container: 'w-44 h-44 sm:w-52 sm:h-52', svg: 'w-36 h-36 sm:w-44 sm:h-44', ring: 'w-44 h-44 sm:w-52 sm:h-52' },
    xl: { container: 'w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72', svg: 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64', ring: 'w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`relative flex flex-col items-center justify-center select-none group ${className}`}>
      {/* Outer Tactical Radar Scanning Rings with Glowing Aura */}
      {withPulsingRadar && (
        <>
          {/* Ambient Saffron & Gold Radial Backlight */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF9933]/25 via-amber-500/20 to-[#10B981]/15 filter blur-2xl transform scale-125 pointer-events-none group-hover:scale-140 group-hover:opacity-100 transition-all duration-700 opacity-80" />

          {/* Concentric Rotating Tactical Compass/Radar Ring */}
          <div
            className={`absolute ${currentSize.ring} rounded-full border border-amber-400/30 border-dashed animate-spin pointer-events-none`}
            style={{ animationDuration: '30s' }}
          />

          {/* Secondary Counter-Rotating Ring */}
          <div
            className={`absolute ${currentSize.ring} rounded-full border border-sky-400/25 border-dotted animate-spin pointer-events-none`}
            style={{ animationDuration: '45s', animationDirection: 'reverse', transform: 'scale(0.88)' }}
          />

          {/* Pulsing Tactical Sonar Ring */}
          <div
            className={`absolute ${currentSize.ring} rounded-full border border-[#FF9933]/40 pointer-events-none pulsing-ring`}
          />
        </>
      )}

      {/* Main IAF Crest Symbol (Detailed SVG with Golden Eagle, Ashoka Crown, and Tricolor Roundel) */}
      <div className={`relative ${currentSize.container} flex items-center justify-center filter drop-shadow-[0_0_25px_rgba(255,153,51,0.5)] transform transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-1`}>
        <svg
          viewBox="0 0 320 320"
          className={`${currentSize.svg} overflow-visible`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gold Metallic Gradients for Eagle & Crown */}
            <linearGradient id="iafGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF2A7" />
              <stop offset="25%" stopColor="#F5D061" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="75%" stopColor="#AA771C" />
              <stop offset="100%" stopColor="#F5D061" />
            </linearGradient>

            <linearGradient id="iafWingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFE58F" />
              <stop offset="40%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#875810" />
            </linearGradient>

            {/* Saffron Gradient */}
            <radialGradient id="iafSaffronGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFA64D" />
              <stop offset="85%" stopColor="#FF7700" />
              <stop offset="100%" stopColor="#E65C00" />
            </radialGradient>

            {/* Green Gradient */}
            <radialGradient id="iafGreenGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1DB954" />
              <stop offset="85%" stopColor="#138808" />
              <stop offset="100%" stopColor="#0B5505" />
            </radialGradient>

            {/* Specular White Rim */}
            <linearGradient id="specularRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
            </linearGradient>

            {/* Subtle glow filter */}
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. ASHOKA LION CAPITAL CROWN (Top Apex) */}
          <g transform="translate(160, 26) scale(0.9)" filter="url(#goldGlow)">
            {/* Central Pillar Abacus & Three Lions representation */}
            <path
              d="M-22 36 L22 36 L26 44 L-26 44 Z"
              fill="url(#iafGoldGrad)"
              stroke="#684205"
              strokeWidth="1.2"
            />
            {/* Center Lion */}
            <path
              d="M-8 12 Q-14 -4 0 -12 Q14 -4 8 12 Q12 24 8 36 L-8 36 Q-12 24 -8 12 Z"
              fill="url(#iafGoldGrad)"
            />
            {/* Left Lion Mane & Profile */}
            <path
              d="M-8 8 Q-22 0 -24 16 Q-26 28 -18 36 L-8 36 Z"
              fill="url(#iafGoldGrad)"
            />
            {/* Right Lion Mane & Profile */}
            <path
              d="M8 8 Q22 0 24 16 Q26 28 18 36 L8 36 Z"
              fill="url(#iafGoldGrad)"
            />
            {/* Ashoka Wheel Base Circle */}
            <circle cx="0" cy="40" r="4" fill="#000080" stroke="#FFE58F" strokeWidth="0.8" />
          </g>

          {/* 2. THE HIMALAYAN GOLDEN EAGLE (Aerodynamic Outstretched Wings) */}
          <g id="iafEagleWings" filter="url(#goldGlow)">
            {/* Left Wing Primary Feathers */}
            <path
              d="M148 100 Q120 70 80 62 Q50 60 20 72 Q35 88 56 98 Q30 102 14 116 Q36 122 58 126 Q28 134 18 150 Q44 150 72 146 Q50 162 40 178 Q70 170 98 158 Q82 178 78 196 Q106 182 126 166 Q118 190 118 208 Q138 188 152 168 Z"
              fill="url(#iafWingGrad)"
              stroke="#5E3804"
              strokeWidth="1.5"
            />
            {/* Left Wing Layered Inner Secondary Feathers */}
            <path
              d="M144 108 Q120 86 86 82 Q64 96 82 112 Q64 122 84 134 Q96 116 120 114 Q106 136 128 144 Z"
              fill="url(#iafGoldGrad)"
              opacity="0.9"
            />

            {/* Right Wing Primary Feathers */}
            <path
              d="M172 100 Q200 70 240 62 Q270 60 300 72 Q285 88 264 98 Q290 102 306 116 Q284 122 262 126 Q292 134 302 150 Q276 150 248 146 Q270 162 280 178 Q250 170 222 158 Q238 178 242 196 Q214 182 194 166 Q202 190 202 208 Q182 188 168 168 Z"
              fill="url(#iafWingGrad)"
              stroke="#5E3804"
              strokeWidth="1.5"
            />
            {/* Right Wing Layered Inner Secondary Feathers */}
            <path
              d="M176 108 Q200 86 234 82 Q256 96 238 112 Q256 122 236 134 Q224 116 200 114 Q214 136 192 144 Z"
              fill="url(#iafGoldGrad)"
              opacity="0.9"
            />

            {/* Eagle Head & Beak Profile */}
            <path
              d="M152 76 Q156 64 160 62 Q164 64 168 76 Q176 86 168 96 Q164 100 160 102 Q156 100 152 96 Q144 86 152 76 Z"
              fill="url(#iafGoldGrad)"
              stroke="#5E3804"
              strokeWidth="1.2"
            />
            <path
              d="M158 66 L160 58 L162 66 Z"
              fill="#FFF2A7"
            />
            {/* Fierce Eagle Eye Dots */}
            <circle cx="157" cy="74" r="1.5" fill="#3E1C00" />
            <circle cx="163" cy="74" r="1.5" fill="#3E1C00" />
          </g>

          {/* 3. CENTRAL MEDALLION & TRICOLOR ROUNDEL */}
          <g id="iafCentralRoundel" transform="translate(160, 168)">
            {/* Outer Decorative Golden Beaded Wreath Ring */}
            <circle
              cx="0"
              cy="0"
              r="68"
              fill="#060E1D"
              stroke="url(#iafGoldGrad)"
              strokeWidth="5"
              filter="url(#goldGlow)"
            />

            {/* Inset Specular Shadow Ring */}
            <circle
              cx="0"
              cy="0"
              r="64"
              stroke="url(#specularRim)"
              strokeWidth="2"
              fill="none"
            />

            {/* Saffron Outer Roundel Circle */}
            <circle
              cx="0"
              cy="0"
              r="58"
              fill="url(#iafSaffronGrad)"
              stroke="#B34700"
              strokeWidth="1.5"
            />

            {/* Pure White Middle Ring */}
            <circle
              cx="0"
              cy="0"
              r="38"
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth="1"
            />

            {/* India Green Inner Circle */}
            <circle
              cx="0"
              cy="0"
              r="19"
              fill="url(#iafGreenGrad)"
              stroke="#084203"
              strokeWidth="1.2"
            />

            {/* Subtle Specular Arc Highlight on Roundel */}
            <path
              d="M-36 -28 A46 46 0 0 1 36 -28"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.6"
            />
          </g>

          {/* 4. THE SACRED MOTTO SCROLL & BANNER (Bottom) */}
          <g id="iafMottoScroll" transform="translate(160, 268)">
            {/* Ribbon Background Shape */}
            <path
              d="M-115 16 L-130 32 L-100 28 L-90 14 L90 14 L100 28 L130 32 L115 16 L120 -4 L-120 -4 Z"
              fill="url(#iafGoldGrad)"
              stroke="#4D2E05"
              strokeWidth="1.5"
            />
            {/* Main Center Banner Plaque */}
            <rect
              x="-98"
              y="-10"
              width="196"
              height="28"
              rx="4"
              fill="#0A1428"
              stroke="url(#iafGoldGrad)"
              strokeWidth="2"
            />
            {/* Sanskrit Motto: नभः स्पृशं दीप्तम् (Touch the Sky with Glory) */}
            <text
              x="0"
              y="9"
              textAnchor="middle"
              fill="#FFE885"
              fontSize="12.5"
              fontWeight="900"
              fontFamily="'Noto Sans Devanagari', 'Inter', sans-serif"
              letterSpacing="1"
            >
              नभः स्पृशं दीप्तम्
            </text>
          </g>
        </svg>
      </div>

      {/* Optional Bilingual Bottom Sub-Header Label */}
      {showMotto && (
        <div className="mt-3 text-center space-y-0.5">
          <div className="font-extrabold tracking-widest text-xs sm:text-sm font-mono text-white flex items-center justify-center gap-1.5">
            <span className="text-[#FF9933]">BHARATIYA</span>
            <span className="text-white">VAYU</span>
            <span className="text-[#10B981]">SENA</span>
          </div>
          <div className="text-[10px] text-amber-300 font-sans tracking-widest font-semibold uppercase">
            Touch The Sky With Glory
          </div>
        </div>
      )}
    </div>
  );
};
