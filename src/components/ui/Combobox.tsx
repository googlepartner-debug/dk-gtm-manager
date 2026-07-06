import { useState, useRef, useEffect } from 'react';

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function Combobox({ options, value, onChange, placeholder = 'Rechercher…', emptyMessage = 'Aucun résultat' }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative">
      {open ? (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full h-9 px-3 text-sm border border-primary rounded-lg bg-card text-foreground focus:outline-none ring-2 ring-primary/30"
        />
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          aria-label={selected ? `Compte sélectionné : ${selected.label}` : 'Choisir un compte'}
          className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground text-left flex items-center justify-between hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
        >
          <span className={selected ? 'text-foreground' : 'text-muted-fg'}>
            {selected ? selected.label : '— Choisir un compte —'}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-muted-fg" aria-hidden="true">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden" role="listbox">
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-fg">{emptyMessage}</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => handleSelect(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    o.value === value
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
          {filtered.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border text-xs text-muted-fg">
              {filtered.length} compte{filtered.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
