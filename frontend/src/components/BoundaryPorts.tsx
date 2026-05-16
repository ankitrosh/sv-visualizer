import { BoundaryPinLayout, gp } from '../hooks/useLayout';

interface Props {
  pins: BoundaryPinLayout[];
  canvasW: number;
}

const DIR_COLOR: Record<string, string> = {
  input: '#60a5fa',
  output: '#4ade80',
  inout: '#fbbf24',
};

export function BoundaryPorts({ pins }: Props) {
  return (
    <g>
      {pins.map(pin => {
        const cx = gp(pin.gx);
        const cy = gp(pin.gy);
        const isOutput = pin.direction === 'output';

        return (
          <g key={`${isOutput ? 'o' : 'i'}-${pin.row}-${pin.portName}`}>
            <circle cx={cx} cy={cy} r={5} fill={DIR_COLOR[pin.direction]} />
            <text
              x={isOutput ? cx + 9 : cx - 9}
              y={cy}
              textAnchor={isOutput ? 'start' : 'end'}
              dominantBaseline="middle"
              fill="#94a3b8" fontSize={10}
              fontFamily="ui-monospace, monospace"
            >
              {pin.portName}
            </text>
          </g>
        );
      })}
    </g>
  );
}
