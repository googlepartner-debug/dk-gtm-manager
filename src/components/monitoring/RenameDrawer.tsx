import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { RenameOperation } from '../../types/gtm';

export interface ContainerOption {
  containerId: string;
  containerName: string;
  publicId: string;
  currentName: string | null; // null = tag absent from this container
}

interface RenameDrawerProps {
  rowKey: string;
  category: string;
  categoryColor: string;
  options: ContainerOption[];
  existingRenames: RenameOperation[];
  onSave: (ops: Omit<RenameOperation, 'id' | 'status' | 'createdAt'>[]) => void;
  onClose: () => void;
}

export function RenameDrawer({
  rowKey,
  category,
  categoryColor,
  options,
  existingRenames,
  onSave,
  onClose,
}: RenameDrawerProps) {
  // Pre-fill with the most frequent existing name (or rowKey as fallback)
  function getMostFrequentName(): string {
    const names = options.flatMap((o) => (o.currentName ? [o.currentName] : []));
    if (names.length === 0) return rowKey;
    const freq = new Map<string, number>();
    for (const n of names) freq.set(n, (freq.get(n) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const [newName, setNewName] = useState(getMostFrequentName);
  // Auto-check containers where tag exists AND name differs from target
  const [checked, setChecked] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const opt of options) {
      if (opt.currentName !== null && opt.currentName !== newName) {
        initial.add(opt.containerId);
      }
    }
    return initial;
  });

  // Recompute checked when newName changes
  useEffect(() => {
    setChecked((prev) => {
      const next = new Set<string>();
      for (const opt of options) {
        if (opt.currentName === null) continue; // can't rename absent tags
        const alreadyQueued = existingRenames.some(
          (r) => r.containerId === opt.containerId && r.rowKey === rowKey,
        );
        if (alreadyQueued) continue;
        if (opt.currentName !== newName && prev.has(opt.containerId)) {
          next.add(opt.containerId);
        } else if (opt.currentName !== newName) {
          next.add(opt.containerId);
        }
      }
      return next;
    });
  }, [newName]);

  function toggleCheck(containerId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(containerId)) next.delete(containerId);
      else next.add(containerId);
      return next;
    });
  }

  const opsToAdd = options.filter(
    (o) => o.currentName !== null && checked.has(o.containerId) && o.currentName !== newName,
  );

  function handleSave() {
    if (!newName.trim() || opsToAdd.length === 0) return;
    onSave(
      opsToAdd.map((o) => ({
        rowKey,
        category,
        containerId: o.containerId,
        containerName: o.containerName,
        publicId: o.publicId,
        oldName: o.currentName!,
        newName: newName.trim(),
      })),
    );
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'hsl(220 13% 10% / 0.35)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl"
        style={{ width: '480px', backgroundColor: 'white', borderLeft: '1px solid hsl(220 13% 91%)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: 'hsl(220 13% 91%)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: categoryColor + '22', color: categoryColor }}
              >
                {category}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-foreground">Renommer — {rowKey}</h2>
            <p className="text-xs text-muted-fg mt-0.5">Standardiser le nom du tag sur plusieurs containers</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-fg hover:text-foreground shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* New name input */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Nouveau nom standardisé
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all font-mono"
              style={{
                borderColor: 'hsl(220 13% 85%)',
                backgroundColor: 'hsl(220 20% 98%)',
                color: 'hsl(220 13% 15%)',
              }}
              placeholder="ex: GA4 — add_to_cart"
              autoFocus
            />
          </div>

          {/* Container list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">Appliquer à</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const eligible = options.filter((o) => o.currentName !== null && o.currentName !== newName);
                    setChecked(new Set(eligible.map((o) => o.containerId)));
                  }}
                  className="text-[11px] text-muted-fg hover:text-foreground transition-colors"
                >
                  Tout sélectionner
                </button>
                <span className="text-muted-fg opacity-40">·</span>
                <button
                  onClick={() => setChecked(new Set())}
                  className="text-[11px] text-muted-fg hover:text-foreground transition-colors"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {options.map((opt) => {
                const isAbsent = opt.currentName === null;
                const alreadyQueued = existingRenames.some(
                  (r) => r.containerId === opt.containerId && r.rowKey === rowKey,
                );
                const alreadyCorrect = opt.currentName === newName.trim();
                const isChecked = checked.has(opt.containerId);
                const isDisabled = isAbsent || alreadyQueued || alreadyCorrect;

                return (
                  <div
                    key={opt.containerId}
                    onClick={() => !isDisabled && toggleCheck(opt.containerId)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:border-opacity-60',
                    )}
                    style={{
                      borderColor: isChecked && !isDisabled ? categoryColor + '55' : 'hsl(220 13% 91%)',
                      backgroundColor: isChecked && !isDisabled ? categoryColor + '08' : 'white',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className={clsx(
                        'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all',
                      )}
                      style={{
                        borderColor: isChecked && !isDisabled ? categoryColor : 'hsl(220 13% 80%)',
                        backgroundColor: isChecked && !isDisabled ? categoryColor : 'white',
                      }}
                    >
                      {isChecked && !isDisabled && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4l2 2L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Container info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground truncate">{opt.containerName}</span>
                        <span className="text-[10px] text-muted-fg font-mono shrink-0">{opt.publicId}</span>
                      </div>

                      {isAbsent ? (
                        <span className="text-[11px] text-muted-fg">Tag absent de ce container</span>
                      ) : alreadyQueued ? (
                        <span className="text-[11px]" style={{ color: 'hsl(46 90% 45%)' }}>
                          Renommage déjà planifié
                        </span>
                      ) : alreadyCorrect ? (
                        <div className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 2.5" stroke="hsl(142 60% 40%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[11px]" style={{ color: 'hsl(142 60% 40%)' }}>Déjà correct</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-muted-fg truncate max-w-[140px]" title={opt.currentName!}>
                            {opt.currentName}
                          </span>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted-fg">
                            <path d="M2.5 5h5M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span
                            className="text-[11px] font-mono truncate max-w-[140px]"
                            style={{ color: categoryColor }}
                            title={newName.trim()}
                          >
                            {newName.trim() || '…'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t flex items-center justify-between gap-3"
          style={{ borderColor: 'hsl(220 13% 91%)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border transition-colors text-muted-fg hover:text-foreground"
            style={{ borderColor: 'hsl(220 13% 85%)' }}
          >
            Annuler
          </button>

          <button
            disabled={opsToAdd.length === 0 || !newName.trim()}
            onClick={handleSave}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg transition-all',
              opsToAdd.length > 0 && newName.trim()
                ? 'text-white shadow-sm hover:opacity-90'
                : 'opacity-40 cursor-not-allowed text-white',
            )}
            style={{ backgroundColor: categoryColor }}
          >
            {opsToAdd.length === 0
              ? 'Sélectionner des containers'
              : `Planifier ${opsToAdd.length} renommage${opsToAdd.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  );
}
