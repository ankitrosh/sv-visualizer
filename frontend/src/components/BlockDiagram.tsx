import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { HierarchyNode } from '../types/hierarchy';
import { computeLayout, computeWires } from '../hooks/useLayout';
import { ModuleBlock } from './ModuleBlock';
import { WireLayer } from './WireLayer';
import { BoundaryPorts } from './BoundaryPorts';

interface Props {
  node: HierarchyNode;
  search: string;
  hoveredSignal: string | null;
  onClickModule: (n: HierarchyNode) => void;
  onHoverSignal: (s: string | null) => void;
}

export function BlockDiagram({
  node,
  search,
  hoveredSignal,
  onClickModule,
  onHoverSignal,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const { blocks, boundaryPins, canvasW, canvasH, wires, sortedChildren } = useMemo(() => {
    const layout = computeLayout(node.children, node.ports);
    const wires  = computeWires(layout.sortedChildren, layout.blocks, layout.boundaryPins);
    return { ...layout, wires };
  }, [node]);

  useEffect(() => {
    if (!svgRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    setZoom(1);
    setPan({
      x: (width - canvasW) / 2,
      y: (height - canvasH) / 2,
    });
  }, [node, canvasW, canvasH]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => Math.min(Math.max(z * factor, 0.15), 8));
  }, []);

  const searchLower = search.toLowerCase();

  if (node.children.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-3">◻</div>
          <p className="text-slate-300 font-mono">{node.name}</p>
          <p className="text-sm mt-1">Leaf module — no instantiated children</p>
          {node.file && <p className="text-xs mt-2 text-blue-500 font-mono">{node.file}</p>}
        </div>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      className="flex-1 block"
      style={{
        background: '#0f172a',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Dot-grid background */}
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"
          patternTransform={`translate(${pan.x % 30} ${pan.y % 30}) scale(${zoom})`}>
          <circle cx="0" cy="0" r="0.8" fill="#1e293b" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        <BoundaryPorts pins={boundaryPins} canvasW={canvasW} />
        <WireLayer
          wires={wires}
          hoveredSignal={hoveredSignal}
          onHoverSignal={onHoverSignal}
        />
        {sortedChildren.map((child, idx) => {
          const isMatch =
            searchLower !== '' &&
            (child.name.toLowerCase().includes(searchLower) ||
              child.instance_name.toLowerCase().includes(searchLower) ||
              child.connections.some(c => c.signal.toLowerCase().includes(searchLower)));

          return (
            <ModuleBlock
              key={child.instance_name}
              node={child}
              layout={blocks[idx]}
              highlighted={isMatch}
              hoveredSignal={hoveredSignal}
              onClick={() => onClickModule(child)}
              onHoverSignal={onHoverSignal}
            />
          );
        })}
      </g>

      {/* Zoom indicator */}
      <text x={8} y="100%" dy={-8} fill="#334155" fontSize={10} fontFamily="monospace">
        {Math.round(zoom * 100)}%
      </text>
    </svg>
  );
}
