import { useState, useEffect, useCallback } from 'react';
import { HierarchyFile, HierarchyNode } from './types/hierarchy';
import { BlockDiagram } from './components/BlockDiagram';
import { DetailPanel } from './components/DetailPanel';
import { Breadcrumb } from './components/Breadcrumb';
import { SearchBar } from './components/SearchBar';

// Synthetic root that wraps the real top module so the initial view shows
// just one box (the top module) rather than jumping straight into its children.
function makeSyntheticRoot(topNode: HierarchyNode): HierarchyNode {
  return {
    name: '',           // empty name = home icon in breadcrumb
    instance_name: '',
    file: null,
    ports: [],
    connections: [],
    children: [topNode],
  };
}

export default function App() {
  const [data, setData] = useState<HierarchyFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navStack, setNavStack] = useState<HierarchyNode[]>([]);
  const [selected, setSelected] = useState<HierarchyNode | null>(null);
  const [search, setSearch] = useState('');
  const [hoveredSignal, setHoveredSignal] = useState<string | null>(null);

  const loadData = useCallback((d: HierarchyFile) => {
    const root = 'hierarchy' in d ? d.hierarchy : (d as unknown as HierarchyNode);
    setData({ hierarchy: root });
    setNavStack([makeSyntheticRoot(root)]);
    setSelected(null);
    setSearch('');
    setLoadError(null);
  }, []);

  useEffect(() => {
    fetch('/hierarchy.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(loadData)
      .catch(() =>
        setLoadError(
          'No hierarchy.json found. Run ./run.sh --top <module> --src <dir>, or upload a file.',
        ),
      );
  }, [loadData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        loadData(JSON.parse(ev.target!.result as string));
      } catch {
        setLoadError('Invalid JSON — could not parse the file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Single-click handler: navigate into a block if it has children,
  // otherwise open the detail panel.
  const handleClickModule = useCallback((child: HierarchyNode) => {
    if (child.children.length > 0) {
      setNavStack(s => [...s, child]);
      setSelected(child);   // detail panel shows the module we just entered
      setSearch('');
    } else {
      setSelected(child);   // leaf → just show detail panel
    }
  }, []);

  const navigateTo = useCallback((index: number) => {
    setNavStack(s => {
      const leaving = s[index + 1] ?? null; // the node we're stepping out of
      setSelected(leaving);
      return s.slice(0, index + 1);
    });
    setSearch('');
  }, []);

  const currentNode = navStack[navStack.length - 1];

  // ── Error / loading screen ───────────────────────────────────────────────
  if (!data || !currentNode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-300 gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">SV Module Visualizer</h1>
          <p className="text-slate-400 text-sm max-w-md">
            {loadError ?? 'Loading…'}
          </p>
        </div>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
          Upload hierarchy.json
          <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
        </label>
        {loadError && (
          <p className="text-slate-600 text-xs max-w-sm text-center">
            Place a <code className="text-slate-400">hierarchy.json</code> in{' '}
            <code className="text-slate-400">frontend/public/</code> and refresh, or use{' '}
            <code className="text-slate-400">./run.sh --top &lt;module&gt;</code>.
          </p>
        )}
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center gap-4 px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0 h-11">
        <span className="text-white font-bold text-sm tracking-tight shrink-0">SV Visualizer</span>
        <span className="text-slate-700">|</span>
        <Breadcrumb stack={navStack} onNavigate={navigateTo} />
        <div className="ml-auto flex items-center gap-3">
          <SearchBar value={search} onChange={setSearch} />
          <label
            className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            title="Load a different hierarchy.json"
          >
            Load JSON
            <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {/* ── Canvas + Detail Panel ── */}
      <div className="flex flex-1 overflow-hidden">
        <BlockDiagram
          node={currentNode}
          search={search}
          hoveredSignal={hoveredSignal}
          onClickModule={handleClickModule}
          onHoverSignal={setHoveredSignal}
        />
        {selected && (
          <DetailPanel node={selected} onClose={() => setSelected(null)} />
        )}
      </div>

      {/* ── Footer hint ── */}
      <div className="px-4 py-1 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-600 flex gap-4 shrink-0">
        <span>Click — expand / details</span>
        <span>Scroll — zoom</span>
        <span>Drag — pan</span>
        <span>Hover wire — highlight signal</span>
      </div>
    </div>
  );
}
