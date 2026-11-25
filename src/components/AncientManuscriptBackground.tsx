import React from 'react';
import { motion } from 'motion/react';

// Generates floating glowing embers (particles of burning manuscript)
const EMBERS = Array.from({ length: 18 }).map((_, i) => ({
  id: i,
  left: `${(i * 5.8 + (i * 13) % 17) % 98}%`,
  bottom: `${(i * 6.5) % 22}%`,
  size: 2 + (i % 4) * 1.5,
  duration: 4 + (i % 5) * 1.5,
  delay: (i * 0.35) % 4,
  xOffset: (i % 2 === 0 ? 1 : -1) * (15 + (i * 7) % 25)
}));

export const AncientManuscriptBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none" aria-hidden="true">
      {/* SVG Texture Filters for Crumpled Aged Parchment */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <filter id="manuscript-paper-noise" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" result="noise" />
          <feColorMatrix type="matrix" values="0.8 0 0 0 0  0 0.7 0 0 0  0 0 0.5 0 0  0 0 0 0.14 0" result="coloredNoise" />
        </filter>
        
        <filter id="crumpled-creases" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="turbulence" baseFrequency="0.01 0.05" numOctaves="4" result="creaseTurb" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.05  0 0 0 0.18 0" result="creaseMatrix" />
        </filter>

        <filter id="ember-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>

      {/* Aged Crumpled Paper Grain Layer */}
      <div 
        className="absolute inset-0 opacity-60 mix-blend-multiply" 
        style={{ filter: 'url(#manuscript-paper-noise)' }} 
      />

      {/* Crumpled Creases & Wrinkles Overlay */}
      <div 
        className="absolute inset-0 opacity-40 mix-blend-overlay" 
        style={{ filter: 'url(#crumpled-creases)' }} 
      />

      {/* Vignette & Aged Edge Darkening (Burnt Parchment Perimeter) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(40,20,5,0.45)_80%,_rgba(18,8,2,0.75)_100%)] pointer-events-none" />

      {/* Hand-drawn Crumpled Wrinkle Lines & Scuffs Overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-25 mix-blend-multiply" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#3a1d06" fill="none" strokeWidth="0.75">
          {/* Main diagonal fold creases */}
          <path d="M-10,50 L350,420 M200,-20 L800,700 M500,-50 L1100,550 M-50,600 L600,1100 M700,100 L1400,900" strokeDasharray="120 20 80 40" opacity="0.6" />
          <path d="M1200,-50 L400,600 M900,-20 L100,900 M1500,200 L600,1200 M600,-50 L-100,800" strokeDasharray="90 30 150 20" opacity="0.5" />
          
          {/* Fine scuffs & paper cracks */}
          <path d="M120,180 L140,195 L135,210 M450,80 L470,70 L485,90 M820,310 L840,325 L830,345 M250,720 L275,710 L290,735 M1050,650 L1080,670 M750,850 L780,840 L795,870" opacity="0.7" strokeWidth="1" />
          
          {/* Coffee/wax alchemical ring stains */}
          <circle cx="15%" cy="25%" r="65" stroke="#4a280c" strokeWidth="1.2" strokeDasharray="15 8 40 5" opacity="0.35" />
          <circle cx="82%" cy="70%" r="90" stroke="#4a280c" strokeWidth="1.5" strokeDasharray="30 10 70 8" opacity="0.3" />
        </g>
      </svg>

      {/* 12th Century Ancient Manuscript Drawings & Astrolabe Watermarks */}
      <svg className="absolute inset-0 w-full h-full opacity-12 text-sepia" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="latin-runes" width="450" height="450" patternUnits="userSpaceOnUse">
            <text x="20" y="35" fontSize="10" fontFamily="serif" fill="#704214" opacity="0.5" fontStyle="italic">
              Prima Materia - Ignis, Aer, Aqua, Terra - Hermeticus Codex XII
            </text>
            <text x="20" y="235" fontSize="10" fontFamily="serif" fill="#704214" opacity="0.5" fontStyle="italic">
              Transmutatio Elementorum - Magna Opera - Aurum & Ebor
            </text>
          </pattern>
        </defs>

        {/* Top-Left Astrolabe Geometry */}
        <g transform="translate(60, 60)" stroke="#704214" strokeWidth="0.85" fill="none" opacity="0.65">
          <circle cx="60" cy="60" r="55" strokeDasharray="3 3" />
          <circle cx="60" cy="60" r="42" />
          <polygon points="60,5 110,95 10,95" />
          <polygon points="60,115 110,25 10,25" />
          <circle cx="60" cy="60" r="15" strokeDasharray="2 2" />
          <text x="60" y="64" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#704214" stroke="none">🜁 🜂 🜄 🜃</text>
        </g>

        {/* Top-Right Sacred Circle Geometry */}
        <svg x="100%" y="60" overflow="visible">
          <g transform="translate(-160, 0)" stroke="#c9a343" strokeWidth="0.85" fill="none" opacity="0.55">
            <circle cx="60" cy="60" r="50" />
            <circle cx="60" cy="60" r="35" strokeDasharray="4 2" />
            <rect x="25" y="25" width="70" height="70" transform="rotate(45 60 60)" />
            <circle cx="60" cy="60" r="8" fill="#c9a343" opacity="0.25" />
          </g>
        </svg>

        {/* Background Watermark Pattern */}
        <rect width="100%" height="100%" fill="url(#latin-runes)" />
      </svg>

      {/* Floating Glowing Manuscript Embers / Sparks */}
      {EMBERS.map((ember) => (
        <motion.div
          key={ember.id}
          initial={{ y: 0, x: 0, opacity: 0, scale: 0.6 }}
          animate={{
            y: [-10, -180 - (ember.id * 15)],
            x: [0, ember.xOffset, ember.xOffset * 0.5],
            opacity: [0, 0.85, 0.6, 0.9, 0],
            scale: [0.6, 1.2, 0.8, 0.4]
          }}
          transition={{
            duration: ember.duration,
            repeat: Infinity,
            delay: ember.delay,
            ease: "easeOut"
          }}
          style={{
            position: 'absolute',
            left: ember.left,
            bottom: ember.bottom,
            width: `${ember.size}px`,
            height: `${ember.size}px`,
            borderRadius: '50%',
            background: ember.id % 3 === 0 ? '#ff9d00' : ember.id % 2 === 0 ? '#ff6600' : '#c9a343',
            boxShadow: `0 0 ${ember.size * 2}px ${ember.id % 2 === 0 ? '#ff8800' : '#ffd700'}`,
            filter: 'url(#ember-glow)'
          }}
        />
      ))}
    </div>
  );
};

