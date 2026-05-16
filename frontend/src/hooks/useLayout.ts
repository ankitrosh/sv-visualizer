import { HierarchyNode, Port, Direction } from '../types/hierarchy';

// ── Grid constants ────────────────────────────────────────────────────────────
export const G             = 20;   // 1 grid unit = 20 px
export const PORT_W_G      = 3;    // horizontal slot width for boundary (top/bottom) pins
export const MIN_BLOCK_W_G = 8;    // minimum block width in grid units
export const HEADER_G      = 2;    // block header: 2 u = 40 px
export const PIN_G         = 2;    // height per internal port row: 2 u = 40 px
export const H_GAP_G       = 8;    // horizontal gap between columns (wire lanes)
export const V_GAP_G       = 8;    // vertical gap between rows (wire lanes)
export const PAD_G         = 5;    // canvas padding on all sides
export const PIN_R         = 5;    // pin-circle radius in px (not a grid value)

export const gp = (n: number) => n * G; // grid units → px

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinLayout {
  portName: string;
  direction: Direction;
  width?: string;
  gx: number;
  gy: number;
  slotIndex: number;
}

export interface BlockLayout {
  gx: number; gy: number;
  gw: number; gh: number;
  row: number; col: number;
  topPins: PinLayout[];    // boundary inputs  → top edge (from parent)
  bottomPins: PinLayout[]; // boundary outputs → bottom edge (to parent)
  leftPins: PinLayout[];   // internal inputs  → left edge (child-to-child)
  rightPins: PinLayout[];  // internal outputs → right edge (child-to-child)
}

export interface BoundaryPinLayout {
  portName: string;
  direction: Direction;
  gx: number; gy: number;
  slotIndex: number;
  // row >= 0: per-row input entry point above that block row
  // row === -1: canvas right-edge output pin
  row: number;
}

export interface Wire {
  signal: string;
  points: { x: number; y: number }[];
  isBoundary: boolean;
}

export interface LayoutResult {
  blocks: BlockLayout[];
  boundaryPins: BoundaryPinLayout[];
  canvasW: number;
  canvasH: number;
  sortedChildren: HierarchyNode[]; // children reordered to match blocks[i]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseSignal(s: string) {
  return s.replace(/\s*\[.*$/, '').trim();
}

// ── Connectivity sort ─────────────────────────────────────────────────────────
//
// Reorder children so that signal producers (right-pin outputs) come before
// their consumers (left-pin inputs). Uses Kahn's topological sort on the
// internal signal graph; cycles keep their original relative order.

function sortByConnectivity(
  n: number,
  classified: Array<{ right: Port[]; left: Port[] }>,
  connMaps: Map<string, string>[],
): number[] {
  // For each internal signal: who produces it (right pin) and who consumes it (left pin)
  const producer  = new Map<string, number>();
  const consumers = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const cm = connMaps[i];
    classified[i].right.forEach(p => {
      const sig = cm.get(p.name);
      if (sig) producer.set(baseSignal(sig), i);
    });
    classified[i].left.forEach(p => {
      const sig = cm.get(p.name);
      if (!sig) return;
      const key = baseSignal(sig);
      if (!consumers.has(key)) consumers.set(key, []);
      consumers.get(key)!.push(i);
    });
  }

  // Build directed edges: producer → consumer
  const adj   = Array.from({ length: n }, () => new Set<number>());
  const inDeg = new Array<number>(n).fill(0);

  for (const [sig, prod] of producer.entries()) {
    for (const cons of (consumers.get(sig) ?? [])) {
      if (cons !== prod && !adj[prod].has(cons)) {
        adj[prod].add(cons);
        inDeg[cons]++;
      }
    }
  }

  // Kahn's algorithm — queue seeded in original index order for stable output
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (inDeg[i] === 0) queue.push(i);
  }

  const order: number[]  = [];
  const visited = new Set<number>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    visited.add(node);
    for (const nb of adj[node]) {
      if (--inDeg[nb] === 0) queue.push(nb);
    }
  }
  // Append nodes involved in cycles (keep original relative order)
  for (let i = 0; i < n; i++) {
    if (!visited.has(i)) order.push(i);
  }

  return order; // order[pos] = original child index to place at grid position pos
}

// ── Layout computation ────────────────────────────────────────────────────────

export function computeLayout(children: HierarchyNode[], parentPorts: Port[]): LayoutResult {
  const n = children.length;
  if (n === 0) return { blocks: [], boundaryPins: [], canvasW: gp(30), canvasH: gp(20), sortedChildren: [] };

  // A child port is "boundary" if its connected signal matches a parent port name.
  const parentPortNames = new Set(parentPorts.map(p => baseSignal(p.name)));

  const classified = children.map(child => {
    const connMap = new Map(child.connections.map(c => [c.port, c.signal]));
    const isBoundary = (port: Port) => {
      const sig = connMap.get(port.name);
      return sig != null && parentPortNames.has(baseSignal(sig));
    };
    return {
      top:    child.ports.filter(p => p.direction !== 'output' &&  isBoundary(p)),
      bottom: child.ports.filter(p => p.direction === 'output' &&  isBoundary(p)),
      left:   child.ports.filter(p => p.direction !== 'output' && !isBoundary(p)),
      right:  child.ports.filter(p => p.direction === 'output' && !isBoundary(p)),
    };
  });

  // Build connMaps early so sortByConnectivity can use them
  const connMaps = children.map(child =>
    new Map(child.connections.map(c => [c.port, c.signal])),
  );

  // Reorder children so signal producers appear before their consumers
  const sortOrder        = sortByConnectivity(n, classified, connMaps);
  const sortedChildren   = sortOrder.map(i => children[i]);
  const sortedClassified = sortOrder.map(i => classified[i]);
  const sortedConnMaps   = sortOrder.map(i => connMaps[i]);

  const numCols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const numRows = Math.ceil(n / numCols);

  // All downstream logic uses the sorted arrays so producers appear before consumers
  // Column width = max block width in that column (driven by top/bottom pin count)
  const colWidths: number[] = Array.from({ length: numCols }, (_, c) => {
    let w = MIN_BLOCK_W_G;
    for (let r = 0; r < numRows; r++) {
      const idx = r * numCols + c;
      if (idx < n) {
        const { top, bottom } = sortedClassified[idx];
        w = Math.max(w, Math.max(top.length, bottom.length, 1) * PORT_W_G);
      }
    }
    return Math.max(w, MIN_BLOCK_W_G);
  });

  // Row height = tallest block in that row (driven by left/right pin count)
  const rowHeights: number[] = Array.from({ length: numRows }, (_, r) => {
    let h = HEADER_G + PIN_G; // minimum 1 internal row
    for (let c = 0; c < numCols; c++) {
      const idx = r * numCols + c;
      if (idx < n) {
        const { left, right } = sortedClassified[idx];
        h = Math.max(h, HEADER_G + Math.max(left.length, right.length, 1) * PIN_G);
      }
    }
    return h;
  });

  // Column / row start positions
  const colStartGX: number[] = colWidths.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? PAD_G : acc[i - 1] + colWidths[i - 1] + H_GAP_G);
    return acc;
  }, []);

  const rowStartGY: number[] = rowHeights.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? PAD_G : acc[i - 1] + rowHeights[i - 1] + V_GAP_G);
    return acc;
  }, []);

  const blocks: BlockLayout[] = sortedChildren.map((_child, i) => {
    const col = i % numCols;
    const row = Math.floor(i / numCols);
    const bx  = colStartGX[col];
    const by  = rowStartGY[row];
    const bw  = colWidths[col];
    const bh  = rowHeights[row];

    const { top, bottom, left, right } = sortedClassified[i];

    // Top pins: left-to-right from block left; bottom pins: right-to-left from block right
    const topPinX    = (idx: number) => bx + idx * PORT_W_G + Math.floor(PORT_W_G / 2);
    const bottomPinX = (idx: number) => bx + bw - 1 - (idx * PORT_W_G + Math.floor(PORT_W_G / 2));
    // Left/right pins: spaced vertically below the header
    const pinY       = (idx: number) => by + HEADER_G + idx * PIN_G + 1;

    return {
      gx: bx, gy: by, gw: bw, gh: bh, row, col,
      topPins: top.map((p, idx) => ({
        portName: p.name, direction: p.direction, width: p.width,
        gx: topPinX(idx), gy: by, slotIndex: idx,
      })),
      bottomPins: bottom.map((p, idx) => ({
        portName: p.name, direction: p.direction, width: p.width,
        gx: bottomPinX(idx), gy: by + bh, slotIndex: idx,
      })),
      leftPins: left.map((p, idx) => ({
        portName: p.name, direction: p.direction, width: p.width,
        gx: bx, gy: pinY(idx), slotIndex: idx,
      })),
      rightPins: right.map((p, idx) => ({
        portName: p.name, direction: p.direction, width: p.width,
        gx: bx + bw, gy: pinY(idx), slotIndex: idx,
      })),
    };
  });

  // Canvas size
  const lastColEnd = colStartGX[numCols - 1] + colWidths[numCols - 1];
  const canvasGW   = lastColEnd + PAD_G;
  const canvasGH   = rowStartGY[numRows - 1] + rowHeights[numRows - 1] + PAD_G;

  const bInputs  = parentPorts.filter(p => p.direction !== 'output');
  const bOutputs = parentPorts.filter(p => p.direction === 'output');

  const boundaryPins: BoundaryPinLayout[] = [];

  // Per-row input entry points (use sortedClassified + sortedConnMaps)
  for (let r = 0; r < numRows; r++) {
    const rowSignals = new Set<string>();
    for (let c = 0; c < numCols; c++) {
      const idx = r * numCols + c;
      if (idx >= n) continue;
      sortedClassified[idx].top.forEach(p => {
        const sig = sortedConnMaps[idx].get(p.name);
        if (sig) rowSignals.add(baseSignal(sig));
      });
    }
    const rowBInputs = bInputs.filter(p => rowSignals.has(baseSignal(p.name)));
    rowBInputs.forEach((p, localIdx) => {
      boundaryPins.push({
        portName: p.name, direction: p.direction,
        gx: 1,
        gy: Math.max(1, rowStartGY[r] - (rowBInputs.length - localIdx)),
        slotIndex: localIdx,
        row: r,
      });
    });
  }

  // Per-row output exit points (use sortedClassified + sortedConnMaps)
  for (let r = 0; r < numRows; r++) {
    const rowOutSignals = new Set<string>();
    for (let c = 0; c < numCols; c++) {
      const idx = r * numCols + c;
      if (idx >= n) continue;
      sortedClassified[idx].bottom.forEach(p => {
        const sig = sortedConnMaps[idx].get(p.name);
        if (sig) rowOutSignals.add(baseSignal(sig));
      });
    }
    const rowBOutputs = bOutputs.filter(p => rowOutSignals.has(baseSignal(p.name)));
    const rowEndGY = rowStartGY[r] + rowHeights[r];
    rowBOutputs.forEach((p, localIdx) => {
      boundaryPins.push({
        portName: p.name, direction: p.direction,
        gx: canvasGW - 1,
        gy: rowEndGY + localIdx + 1,
        slotIndex: localIdx,
        row: r,
      });
    });
  }

  return { blocks, boundaryPins, canvasW: gp(canvasGW), canvasH: gp(canvasGH), sortedChildren };
}

// ── Wire routing ──────────────────────────────────────────────────────────────
//
// Internal wires (child-to-child) use left/right sides — routing unchanged.
// Boundary wires (parent-port signals) use top (inputs) / bottom (outputs).
//
// Routing rules (n = slotIndex + 1):
//   right → left   S-curve through H-gap          (internal output → internal input)
//   right → right  U-right                        (same-side internal)
//   left  → left   U-left or U-below same-row     (same-side internal)
//   left  → right  backward, n+1 above block top  (rare internal)
//   right → top    L-shape from canvas left edge  (canvas input → child top pin)
//   left  → bottom L-shape to canvas right edge   (canvas output → child bottom pin)
//   bottom → top   S-curve through V-gap          (child boundary output → input)
//   top   → top    U-above                        (fanout to multiple top pins)
//   bottom → bottom U-below                       (fanout to multiple bottom pins)
//   top   → bottom backward, n above block top    (rare)

interface Endpoint {
  gx: number; gy: number;
  side: 'top' | 'bottom' | 'left' | 'right';
  slotIndex: number;
  blockGY: number;
  blockGH: number;
  blockRow: number;
  isBoundary: boolean;
  rawSignal: string;
}

function pts(pairs: [number, number][]): { x: number; y: number }[] {
  return pairs.map(([gx, gy]) => ({ x: gp(gx), y: gp(gy) }));
}

function clamp(val: number, lo: number): number {
  return Math.max(lo, val);
}

function routePoints(src: Endpoint, dst: Endpoint): { x: number; y: number }[] {
  const n = src.slotIndex + 1;

  // ── Internal (left / right) ────────────────────────────────────────────────

  if (src.side === 'right' && dst.side === 'left') {
    if (src.gy === dst.gy) return pts([[src.gx, src.gy], [dst.gx, dst.gy]]);
    const midGX = src.gx + n;
    return pts([[src.gx, src.gy], [midGX, src.gy], [midGX, dst.gy], [dst.gx, dst.gy]]);
  }

  if (src.side === 'left' && dst.side === 'right') {
    const exitGX  = src.gx - n;
    const clearGY = clamp(src.blockGY - (n + 1), 1);
    return pts([
      [src.gx, src.gy], [exitGX, src.gy], [exitGX, clearGY],
      [dst.gx + n, clearGY], [dst.gx + n, dst.gy], [dst.gx, dst.gy],
    ]);
  }

  if (src.side === 'right' && dst.side === 'right') {
    const laneGX = Math.max(src.gx, dst.gx) + n;
    return pts([[src.gx, src.gy], [laneGX, src.gy], [laneGX, dst.gy], [dst.gx, dst.gy]]);
  }

  if (src.side === 'left' && dst.side === 'left') {
    const laneGX = Math.min(src.gx, dst.gx) - n;
    if (src.blockRow !== -1 && dst.blockRow !== -1 && src.blockRow === dst.blockRow) {
      const clearGY = src.blockGY + src.blockGH + n;
      return pts([
        [src.gx, src.gy], [laneGX, src.gy], [laneGX, clearGY],
        [dst.gx - n, clearGY], [dst.gx - n, dst.gy], [dst.gx, dst.gy],
      ]);
    }
    if (src.gy <= dst.gy) {
      return pts([[src.gx, src.gy], [laneGX, src.gy], [laneGX, dst.gy], [dst.gx, dst.gy]]);
    }
    const clearGY = clamp(src.blockGY - (n + 1), 1);
    return pts([
      [src.gx, src.gy], [laneGX, src.gy], [laneGX, clearGY],
      [dst.gx - n, clearGY], [dst.gx - n, dst.gy], [dst.gx, dst.gy],
    ]);
  }

  // ── Boundary (top / bottom + canvas-edge left/right) ──────────────────────

  // Row entry pin → child top pin: pin is already at the lane y, so L-shape
  if (src.side === 'right' && dst.side === 'top') {
    return pts([
      [src.gx, src.gy],  // entry pin (already at lane y)
      [dst.gx, src.gy],  // horizontal along the lane
      [dst.gx, dst.gy],  // drop to top pin
    ]);
  }

  // Row exit pin ← child bottom pin: exit pin is already at lane y, so L-shape
  if (src.side === 'left' && dst.side === 'bottom') {
    return pts([
      [src.gx, src.gy],  // exit pin (already at lane y, below block bottom)
      [dst.gx, src.gy],  // horizontal to block bottom pin x
      [dst.gx, dst.gy],  // up to block bottom pin
    ]);
  }

  // Child bottom pin → child top pin (cross-row boundary signal, no canvas pin)
  if (src.side === 'bottom' && dst.side === 'top') {
    const midGY = src.gy + n;
    return pts([[src.gx, src.gy], [src.gx, midGY], [dst.gx, midGY], [dst.gx, dst.gy]]);
  }

  // Fanout: top → top (same boundary input signal to multiple children)
  if (src.side === 'top' && dst.side === 'top') {
    const clearGY = clamp(Math.min(src.gy, dst.gy) - n, 1);
    return pts([[src.gx, src.gy], [src.gx, clearGY], [dst.gx, clearGY], [dst.gx, dst.gy]]);
  }

  // Fanout: bottom → bottom
  if (src.side === 'bottom' && dst.side === 'bottom') {
    const laneGY = Math.max(src.gy, dst.gy) + n;
    return pts([[src.gx, src.gy], [src.gx, laneGY], [dst.gx, laneGY], [dst.gx, dst.gy]]);
  }

  // Backward: top → bottom (rare)
  if (src.side === 'top' && dst.side === 'bottom') {
    const clearGY = clamp(src.gy - n, 1);
    return pts([[src.gx, src.gy], [src.gx, clearGY], [dst.gx, clearGY], [dst.gx, dst.gy]]);
  }

  // Fallback: straight line
  return [{ x: gp(src.gx), y: gp(src.gy) }, { x: gp(dst.gx), y: gp(dst.gy) }];
}

export function computeWires(
  children: HierarchyNode[],
  blocks: BlockLayout[],
  boundaryPins: BoundaryPinLayout[],
): Wire[] {
  const endpointMap = new Map<string, Endpoint[]>();

  function addEP(key: string, ep: Endpoint) {
    if (!endpointMap.has(key)) endpointMap.set(key, []);
    endpointMap.get(key)!.push(ep);
  }

  // All boundary pins are now per-row (row >= 0).
  // Inputs: side='right', key="signal_r{row}"
  // Outputs: side='left', key="signal_r{row}"
  boundaryPins.forEach(bp => {
    const side: Endpoint['side'] = bp.direction !== 'output' ? 'right' : 'left';
    addEP(`${baseSignal(bp.portName)}_r${bp.row}`, {
      gx: bp.gx, gy: bp.gy, side, slotIndex: bp.slotIndex,
      blockGY: 0, blockGH: 0, blockRow: -1, isBoundary: true, rawSignal: bp.portName,
    });
  });

  // Child pins — top/bottom use row-specific keys; left/right use plain signal key
  children.forEach((child, idx) => {
    const block = blocks[idx];

    const sideOf = (portName: string): Endpoint['side'] => {
      if (block.topPins.some(p => p.portName === portName))    return 'top';
      if (block.bottomPins.some(p => p.portName === portName)) return 'bottom';
      if (block.leftPins.some(p => p.portName === portName))   return 'left';
      return 'right';
    };

    const allPins = new Map(
      [...block.topPins, ...block.bottomPins, ...block.leftPins, ...block.rightPins]
        .map(p => [p.portName, p]),
    );

    for (const conn of child.connections) {
      const pin = allPins.get(conn.port);
      if (!pin) continue;
      const side = sideOf(conn.port);
      // Top and bottom pins group with their row's boundary entry/exit pins
      const key = (side === 'top' || side === 'bottom')
        ? `${baseSignal(conn.signal)}_r${block.row}`
        : baseSignal(conn.signal);
      addEP(key, {
        gx: pin.gx, gy: pin.gy,
        side,
        slotIndex: pin.slotIndex,
        blockGY: block.gy, blockGH: block.gh, blockRow: block.row,
        isBoundary: false, rawSignal: conn.signal,
      });
    }
  });

  // Hub priority: canvas-edge boundary first, then boundary outputs (bottom),
  // then internal outputs (right), then boundary inputs (top), then internal inputs (left).
  function epPriority(ep: Endpoint): number {
    if (ep.isBoundary)        return 0;
    if (ep.side === 'bottom') return 1;
    if (ep.side === 'right')  return 2;
    if (ep.side === 'top')    return 3;
    return 4;
  }

  const wires: Wire[] = [];
  for (const [, endpoints] of endpointMap.entries()) {
    if (endpoints.length < 2) continue;
    endpoints.sort((a, b) => epPriority(a) - epPriority(b));
    const hub = endpoints[0];
    for (let i = 1; i < endpoints.length; i++) {
      wires.push({
        signal: hub.rawSignal,
        points: routePoints(hub, endpoints[i]),
        isBoundary: hub.isBoundary || endpoints[i].isBoundary,
      });
    }
  }

  return wires;
}
