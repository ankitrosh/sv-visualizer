interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">⌕</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search modules / signals…"
        className="bg-slate-800 text-slate-200 text-xs placeholder-slate-500 border border-slate-600 rounded pl-7 pr-7 py-1.5 w-52 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-base leading-none"
          aria-label="Clear"
        >
          ×
        </button>
      )}
    </div>
  );
}
