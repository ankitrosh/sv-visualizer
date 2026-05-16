import { HierarchyNode } from '../types/hierarchy';

interface Props {
  node: HierarchyNode;
  onClose: () => void;
}

const DIR_BADGE: Record<string, string> = {
  input: 'bg-blue-950 text-blue-300 border border-blue-800',
  output: 'bg-green-950 text-green-300 border border-green-800',
  inout: 'bg-amber-950 text-amber-300 border border-amber-800',
};

export function DetailPanel({ node, onClose }: Props) {
  return (
    <aside className="w-80 shrink-0 border-l border-slate-700 bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-slate-700">
        <div>
          <div className="text-white font-bold text-sm font-mono">{node.name}</div>
          <div className="text-slate-400 text-xs font-mono mt-0.5">{node.instance_name}</div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xl leading-none mt-0.5 ml-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* File */}
      {node.file && (
        <div className="px-4 py-2 border-b border-slate-700 bg-slate-950/50">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Source file</div>
          <div className="text-xs text-blue-400 font-mono break-all">{node.file}</div>
        </div>
      )}

      {node.circular && (
        <div className="px-4 py-2 bg-red-950 border-b border-red-800">
          <span className="text-red-400 text-xs font-semibold">↺ Circular reference</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Ports */}
        <section className="px-4 py-3">
          <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
            Ports ({node.ports.length})
          </h3>
          {node.ports.length === 0 ? (
            <p className="text-slate-600 text-xs italic">No ports declared</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 text-[10px]">
                  <th className="text-left pb-1 pr-2 font-normal">Dir</th>
                  <th className="text-left pb-1 pr-2 font-normal">Name</th>
                  <th className="text-left pb-1 font-normal">Width</th>
                </tr>
              </thead>
              <tbody>
                {node.ports.map(p => (
                  <tr key={p.name} className="border-t border-slate-800">
                    <td className="py-1 pr-2">
                      <span className={`inline-block px-1.5 py-px rounded text-[10px] font-semibold ${DIR_BADGE[p.direction]}`}>
                        {p.direction}
                      </span>
                    </td>
                    <td className="py-1 pr-2 font-mono text-slate-200">{p.name}</td>
                    <td className="py-1 font-mono text-slate-400">{p.width ?? '1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Connections */}
        {node.connections.length > 0 && (
          <section className="px-4 py-3 border-t border-slate-800">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
              Connections ({node.connections.length})
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 text-[10px]">
                  <th className="text-left pb-1 pr-2 font-normal">.port</th>
                  <th className="text-left pb-1 font-normal">signal</th>
                </tr>
              </thead>
              <tbody>
                {node.connections.map(c => (
                  <tr key={c.port} className="border-t border-slate-800">
                    <td className="py-1 pr-2 font-mono text-slate-300">.{c.port}</td>
                    <td className="py-1 font-mono text-green-400">{c.signal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Children summary */}
        {node.children.length > 0 && (
          <section className="px-4 py-3 border-t border-slate-800">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
              Children ({node.children.length})
            </h3>
            <div className="flex flex-wrap gap-1">
              {node.children.map(c => (
                <span key={c.instance_name} className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                  {c.name}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 italic">Double-click the block to drill in</p>
          </section>
        )}
      </div>
    </aside>
  );
}
