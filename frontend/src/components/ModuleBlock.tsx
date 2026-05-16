import { HierarchyNode } from '../types/hierarchy';
import { BlockLayout, gp, PIN_R } from '../hooks/useLayout';

interface Props {
  node: HierarchyNode;
  layout: BlockLayout;
  highlighted: boolean;
  hoveredSignal: string | null;
  onClick: () => void;
  onHoverSignal: (s: string | null) => void;
}

const DIR_COLOR: Record<string, string> = {
  input: '#60a5fa',
  output: '#4ade80',
  inout: '#fbbf24',
};

function baseSignal(s: string) {
  return s.replace(/\s*\[.*$/, '').trim();
}

export function ModuleBlock({
  node,
  layout,
  highlighted,
  hoveredSignal,
  onClick,
  onHoverSignal,
}: Props) {
  const x = gp(layout.gx);
  const y = gp(layout.gy);
  const w = gp(layout.gw);
  const h = gp(layout.gh);

  const hasChildren = node.children.length > 0;
  const portSignal  = new Map(node.connections.map(c => [c.port, c.signal]));

  const hotPorts = new Set<string>();
  if (hoveredSignal) {
    for (const conn of node.connections) {
      if (baseSignal(conn.signal) === baseSignal(hoveredSignal)) hotPorts.add(conn.port);
    }
  }

  const blockFill   = highlighted ? '#1e3a5f' : '#1e293b';
  const blockStroke = highlighted ? '#3b82f6' : '#334155';
  const headerFill  = highlighted ? '#1d4ed8' : '#334155';

  return (
    <g style={{ cursor: hasChildren ? 'pointer' : 'default' }} onClick={onClick}>
      {/* Drop shadow */}
      <rect x={x + 3} y={y + 3} width={w} height={h} rx={4} fill="#00000050" />

      {/* Block body */}
      <rect
        x={x} y={y} width={w} height={h} rx={4}
        fill={blockFill} stroke={blockStroke} strokeWidth={highlighted ? 2 : 1}
      />

      {/* Header */}
      <rect x={x} y={y} width={w} height={gp(2)} rx={4} fill={headerFill} />
      <rect x={x} y={y + gp(2) - 4} width={w} height={4} fill={headerFill} />

      {/* Module type name */}
      <text
        x={x + w / 2} y={y + gp(1)}
        textAnchor="middle" dominantBaseline="middle"
        fill="#f8fafc" fontSize={13} fontWeight="bold"
        fontFamily="ui-monospace, monospace"
      >
        {node.name}
      </text>

      {/* Instance name */}
      <text
        x={x + w / 2} y={y + gp(2) - 6}
        textAnchor="middle" dominantBaseline="middle"
        fill="#64748b" fontSize={10}
        fontFamily="ui-monospace, monospace"
      >
        {node.instance_name}
      </text>

      {hasChildren && (
        <text x={x + w - 6} y={y + 8} textAnchor="end" fill="#475569" fontSize={9}>▶▶</text>
      )}
      {node.circular && (
        <text x={x + 6} y={y + 8} fill="#f87171" fontSize={9}>↺</text>
      )}

      {/* Top pins: boundary inputs from parent — tick upward, label above */}
      {layout.topPins.map(pin => {
        const sig   = portSignal.get(pin.portName);
        const isHot = hotPorts.has(pin.portName);
        const px    = gp(pin.gx);
        const py    = gp(pin.gy); // = block top (y)
        return (
          <g key={`t-${pin.portName}`}
            onMouseEnter={() => sig && onHoverSignal(sig)}
            onMouseLeave={() => onHoverSignal(null)}
          >
            <line x1={px} y1={py} x2={px} y2={py - 6}
              stroke={isHot ? '#f59e0b' : '#334155'} strokeWidth={1} />
            <circle cx={px} cy={py} r={PIN_R}
              fill={isHot ? '#f59e0b' : DIR_COLOR[pin.direction]} />
            <text
              x={px} y={py - PIN_R - 5}
              textAnchor="middle" dominantBaseline="auto"
              fill={isHot ? '#fbbf24' : '#94a3b8'}
              fontSize={9} fontFamily="ui-monospace, monospace"
            >
              {pin.portName}{pin.width ? ` ${pin.width}` : ''}
            </text>
          </g>
        );
      })}

      {/* Bottom pins: boundary outputs to parent — tick downward, label below */}
      {layout.bottomPins.map(pin => {
        const sig   = portSignal.get(pin.portName);
        const isHot = hotPorts.has(pin.portName);
        const px    = gp(pin.gx);
        const py    = gp(pin.gy); // = block bottom (y + h)
        return (
          <g key={`b-${pin.portName}`}
            onMouseEnter={() => sig && onHoverSignal(sig)}
            onMouseLeave={() => onHoverSignal(null)}
          >
            <line x1={px} y1={py} x2={px} y2={py + 6}
              stroke={isHot ? '#f59e0b' : '#334155'} strokeWidth={1} />
            <circle cx={px} cy={py} r={PIN_R}
              fill={isHot ? '#f59e0b' : DIR_COLOR[pin.direction]} />
            <text
              x={px} y={py + PIN_R + 5}
              textAnchor="middle" dominantBaseline="hanging"
              fill={isHot ? '#fbbf24' : '#94a3b8'}
              fontSize={9} fontFamily="ui-monospace, monospace"
            >
              {pin.portName}{pin.width ? ` ${pin.width}` : ''}
            </text>
          </g>
        );
      })}

      {/* Left pins: internal inputs — tick leftward, label to the right */}
      {layout.leftPins.map(pin => {
        const sig   = portSignal.get(pin.portName);
        const isHot = hotPorts.has(pin.portName);
        const px    = gp(pin.gx);
        const py    = gp(pin.gy);
        return (
          <g key={`l-${pin.portName}`}
            onMouseEnter={() => sig && onHoverSignal(sig)}
            onMouseLeave={() => onHoverSignal(null)}
          >
            <line x1={px} y1={py} x2={px - 6} y2={py}
              stroke={isHot ? '#f59e0b' : '#334155'} strokeWidth={1} />
            <circle cx={px} cy={py} r={PIN_R}
              fill={isHot ? '#f59e0b' : DIR_COLOR[pin.direction]} />
            <text
              x={px + PIN_R + 4} y={py}
              dominantBaseline="middle"
              fill={isHot ? '#fbbf24' : '#94a3b8'}
              fontSize={10} fontFamily="ui-monospace, monospace"
            >
              {pin.portName}{pin.width ? ` ${pin.width}` : ''}
            </text>
          </g>
        );
      })}

      {/* Right pins: internal outputs — tick rightward, label to the left */}
      {layout.rightPins.map(pin => {
        const sig   = portSignal.get(pin.portName);
        const isHot = hotPorts.has(pin.portName);
        const px    = gp(pin.gx);
        const py    = gp(pin.gy);
        return (
          <g key={`r-${pin.portName}`}
            onMouseEnter={() => sig && onHoverSignal(sig)}
            onMouseLeave={() => onHoverSignal(null)}
          >
            <line x1={px} y1={py} x2={px + 6} y2={py}
              stroke={isHot ? '#f59e0b' : '#334155'} strokeWidth={1} />
            <circle cx={px} cy={py} r={PIN_R}
              fill={isHot ? '#f59e0b' : DIR_COLOR[pin.direction]} />
            <text
              x={px - PIN_R - 4} y={py}
              textAnchor="end" dominantBaseline="middle"
              fill={isHot ? '#fbbf24' : '#94a3b8'}
              fontSize={10} fontFamily="ui-monospace, monospace"
            >
              {pin.portName}{pin.width ? ` ${pin.width}` : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}
