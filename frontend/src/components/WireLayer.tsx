import { Wire } from '../hooks/useLayout';

interface Props {
  wires: Wire[];
  hoveredSignal: string | null;
  onHoverSignal: (s: string | null) => void;
}

function baseSignal(s: string) {
  return s.replace(/\s*\[.*$/, '').trim();
}

export function WireLayer({ wires, hoveredSignal, onHoverSignal }: Props) {
  return (
    <g>
      {wires.map((wire, i) => {
        const isHot =
          hoveredSignal !== null &&
          baseSignal(wire.signal) === baseSignal(hoveredSignal);

        const pointsStr = wire.points.map(p => `${p.x},${p.y}`).join(' ');

        // Label at the midpoint vertex of the polyline
        const mid = wire.points[Math.floor(wire.points.length / 2)];

        return (
          <g
            key={i}
            onMouseEnter={() => onHoverSignal(wire.signal)}
            onMouseLeave={() => onHoverSignal(null)}
          >
            {/* Fat transparent hit area */}
            <polyline
              points={pointsStr}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: 'crosshair' }}
            />

            {/* Visible wire — orthogonal polyline */}
            <polyline
              points={pointsStr}
              fill="none"
              stroke={isHot ? '#f59e0b' : wire.isBoundary ? '#64748b' : '#475569'}
              strokeWidth={isHot ? 2.5 : 1.5}
              strokeDasharray={wire.isBoundary ? '4 3' : undefined}
              opacity={hoveredSignal && !isHot ? 0.25 : 1}
              strokeLinejoin="miter"
            />

            {/* Signal label on hover */}
            {isHot && mid && (
              <text
                x={mid.x}
                y={mid.y - 7}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
                style={{ pointerEvents: 'none' }}
              >
                {wire.signal}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
