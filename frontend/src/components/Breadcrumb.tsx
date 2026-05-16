import { HierarchyNode } from '../types/hierarchy';

interface Props {
  stack: HierarchyNode[];
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ stack, onNavigate }: Props) {
  return (
    <nav className="flex items-center gap-1 text-xs font-mono overflow-x-auto">
      {stack.map((node, i) => {
        const isLast = i === stack.length - 1;
        // The synthetic root (name='') is shown as a home icon.
        const label = node.name === '' ? '⌂' : node.name;

        return (
          <span key={i} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-slate-600 select-none">›</span>}
            <button
              onClick={() => onNavigate(i)}
              className={
                isLast
                  ? 'text-white cursor-default'
                  : 'text-blue-400 hover:text-blue-300 hover:underline'
              }
              title={isLast ? undefined : `Go back to ${label}`}
            >
              {label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
