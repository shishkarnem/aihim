import React from 'react';
import { motion } from 'motion/react';

interface NeurosphereLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const NEURAL_NODES = [
  { x: 60, y: 20, r: 3.2, delay: 0 },
  { x: 92, y: 38, r: 2.8, delay: 0.25 },
  { x: 95, y: 74, r: 3.0, delay: 0.5 },
  { x: 60, y: 100, r: 3.2, delay: 0.75 },
  { x: 25, y: 74, r: 2.8, delay: 1.0 },
  { x: 28, y: 38, r: 3.0, delay: 1.25 },
  { x: 47, y: 52, r: 2.6, delay: 0.4 },
  { x: 74, y: 50, r: 2.6, delay: 0.9 },
  { x: 60, y: 74, r: 2.6, delay: 0.6 }
];

const SYNAPSE_LINKS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
  [0, 6], [0, 7], [1, 7], [2, 7], [2, 8], [3, 8],
  [4, 8], [4, 6], [5, 6], [6, 7], [7, 8], [8, 6]
];

export const NeurosphereLoader: React.FC<NeurosphereLoaderProps> = ({
  label = 'Загрузка',
  size = 'md',
  className = ''
}) => {
  const dimensions = size === 'sm' ? 68 : size === 'lg' ? 120 : 92;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-6 px-4 bg-transparent select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="relative flex items-center justify-center bg-transparent"
        style={{ width: dimensions, height: dimensions }}
      >
        <svg
          viewBox="0 0 120 120"
          width={dimensions}
          height={dimensions}
          className="overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="neurosphereCoreGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#b45309" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="neurosphereRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#c9a343" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Soft translucent core glow */}
          <motion.circle
            cx="60"
            cy="60"
            r="34"
            fill="url(#neurosphereCoreGrad)"
            animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.55, 0.95, 0.55] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '60px 60px' }}
          />

          {/* Outer spherical meridian boundary */}
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="#92400e"
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />

          {/* Rotating orbital ellipse 1 */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '60px 60px' }}
          >
            <ellipse
              cx="60"
              cy="60"
              rx="48"
              ry="19"
              fill="none"
              stroke="url(#neurosphereRingGrad)"
              strokeWidth="1.6"
              strokeDasharray="10 6"
              transform="rotate(28 60 60)"
            />
          </motion.g>

          {/* Counter-rotating orbital ellipse 2 */}
          <motion.g
            animate={{ rotate: -360 }}
            transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '60px 60px' }}
          >
            <ellipse
              cx="60"
              cy="60"
              rx="46"
              ry="18"
              fill="none"
              stroke="#b45309"
              strokeOpacity="0.7"
              strokeWidth="1.4"
              strokeDasharray="6 8"
              transform="rotate(-36 60 60)"
            />
          </motion.g>

          {/* Inner equatorial meridian */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '60px 60px' }}
          >
            <ellipse
              cx="60"
              cy="60"
              rx="18"
              ry="42"
              fill="none"
              stroke="#c9a343"
              strokeOpacity="0.55"
              strokeWidth="1.2"
            />
          </motion.g>

          {/* Synaptic lattice links */}
          <g stroke="#92400e" strokeWidth="1" strokeOpacity="0.45">
            {SYNAPSE_LINKS.map(([aIdx, bIdx], idx) => {
              const a = NEURAL_NODES[aIdx];
              const b = NEURAL_NODES[bIdx];
              return (
                <motion.line
                  key={`link-${idx}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  animate={{ strokeOpacity: [0.22, 0.72, 0.22] }}
                  transition={{
                    duration: 2.2,
                    delay: (idx % 5) * 0.2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              );
            })}
          </g>

          {/* Neural nodes */}
          {NEURAL_NODES.map((node, idx) => (
            <motion.circle
              key={`node-${idx}`}
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill="#d97706"
              stroke="#fef3c7"
              strokeWidth="0.9"
              animate={{ scale: [0.85, 1.35, 0.85], opacity: [0.55, 1, 0.55] }}
              transition={{
                duration: 1.8,
                delay: node.delay,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
          ))}

          {/* Center pulsing nucleus */}
          <motion.circle
            cx="60"
            cy="60"
            r="6.5"
            fill="#f59e0b"
            stroke="#fffbeb"
            strokeWidth="1.5"
            animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '60px 60px' }}
          />
        </svg>
      </div>

      {label && (
        <div className="flex items-center gap-1.5 text-[15px] font-medium text-sepia bg-transparent">
          <span>{label}</span>
          <motion.span
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            ...
          </motion.span>
        </div>
      )}
    </div>
  );
};
