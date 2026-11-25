import React from 'react';

interface ParchmentContainerFrameProps {
  className?: string;
}

export const ParchmentContainerFrame: React.FC<ParchmentContainerFrameProps> = ({ className = '' }) => {
  return (
    <svg 
      className={`absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible ${className}`} 
      viewBox="0 0 400 300" 
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Alchemical Border */}
      <rect 
        x="3" y="3" width="394" height="294" rx="10" 
        fill="none" 
        stroke="#704214" 
        strokeWidth="1.5" 
        strokeOpacity="0.45"
        vectorEffect="non-scaling-stroke" 
      />

      {/* Golden Filigree Inner Line */}
      <rect 
        x="7" y="7" width="386" height="286" rx="8" 
        fill="none" 
        stroke="#c9a343" 
        strokeWidth="1" 
        strokeOpacity="0.65"
        strokeDasharray="6 3"
        vectorEffect="non-scaling-stroke" 
      />

      {/* Intricate Corner Alchemical Brackets */}
      {/* Top-Left Corner */}
      <g transform="translate(0, 0)">
        <path 
          d="M2,24 L2,10 Q2,2 10,2 L24,2" 
          fill="none" stroke="#c9a343" strokeWidth="2.5" vectorEffect="non-scaling-stroke" 
        />
        <path 
          d="M6,20 L6,12 Q6,6 12,6 L20,6" 
          fill="none" stroke="#704214" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeOpacity="0.7" 
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="#c9a343" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="12" cy="12" r="1.2" fill="#704214" />
      </g>

      {/* Top-Right Corner */}
      <g transform="translate(400, 0) scale(-1, 1)">
        <path 
          d="M2,24 L2,10 Q2,2 10,2 L24,2" 
          fill="none" stroke="#c9a343" strokeWidth="2.5" vectorEffect="non-scaling-stroke" 
        />
        <path 
          d="M6,20 L6,12 Q6,6 12,6 L20,6" 
          fill="none" stroke="#704214" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeOpacity="0.7" 
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="#c9a343" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="12" cy="12" r="1.2" fill="#704214" />
      </g>

      {/* Bottom-Left Corner */}
      <g transform="translate(0, 300) scale(1, -1)">
        <path 
          d="M2,24 L2,10 Q2,2 10,2 L24,2" 
          fill="none" stroke="#c9a343" strokeWidth="2.5" vectorEffect="non-scaling-stroke" 
        />
        <path 
          d="M6,20 L6,12 Q6,6 12,6 L20,6" 
          fill="none" stroke="#704214" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeOpacity="0.7" 
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="#c9a343" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="12" cy="12" r="1.2" fill="#704214" />
      </g>

      {/* Bottom-Right Corner */}
      <g transform="translate(400, 300) scale(-1, -1)">
        <path 
          d="M2,24 L2,10 Q2,2 10,2 L24,2" 
          fill="none" stroke="#c9a343" strokeWidth="2.5" vectorEffect="non-scaling-stroke" 
        />
        <path 
          d="M6,20 L6,12 Q6,6 12,6 L20,6" 
          fill="none" stroke="#704214" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeOpacity="0.7" 
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="#c9a343" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="12" cy="12" r="1.2" fill="#704214" />
      </g>

      {/* Top Center Alchemical Seal */}
      <g transform="translate(200, 3)">
        <polygon points="0,-3 5,3 0,9 -5,3" fill="#c9a343" />
        <circle cx="0" cy="3" r="1.5" fill="#704214" />
      </g>

      {/* Bottom Center Alchemical Seal */}
      <g transform="translate(200, 297)">
        <polygon points="0,-3 5,3 0,9 -5,3" fill="#c9a343" />
        <circle cx="0" cy="3" r="1.5" fill="#704214" />
      </g>
    </svg>
  );
};
