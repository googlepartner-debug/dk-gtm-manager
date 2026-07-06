import { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import type { MatrixRow } from '../../pages/MonitoringPage';
import type { MonitoringContainerData } from '../../data/monitoring-mock';

export interface BulkRenamePreview {
  rowKey: string;
  category: string;
  containerId: string;
  containerName: string;
  publicId: string;
  oldName: string;
  newName: string;
}

interface BulkRenameModalProps {
  selectedRows: MatrixRow[];
  containers: MonitoringContainerData[];
  onConfirm: (previews: BulkRenamePreview[]) => void;
  onClose: () => void;
}

type Mode = 'replace' | 'template';

const TEMPLATE_VARS = [
  { token: '{key}', label: 'Identifiant logique', desc: 'event_name pour GA4, nom de variable/déclencheur pour les autres' },
  { token: '{prefix}', label: 'Préfixe actuel', desc: 'Tout ce qui précède le premier " - " ou " — " dans le nom actuel' },
  { token: '{suffix}', label: 'Suffixe actuel', desc: 'Tout ce qui suit le premier " - " ou " — " dans le nom actuel' },
];

function applyTemplate(template: string, row: MatrixRow, oldName: string): string {
  const sep = oldName.match(/ [-—] /) ?? null;
  const prefix = sep ? oldName.substring(0, oldName.search(/ [-—] /)) : '';
  const suffix = sep ? oldName.substring(oldName.search(/ [-—] /) + sep[0].length) : oldName;
  return template
    .replace(/\{key\}/g, row.key)
    .replace(/\{prefix\}/g, prefix)
    .replace(/\{suffix\}/g, suffix);
}

export function BulkRenameModal({ selectedRows, containers, onConfirm, onClose }: BulkRenameModalProps) {
  const [mode, setMode] = useState<Mode>('replace');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [template, setTemplate] = useState('');
  const [scope, setScope] = useState<'all' | string>('all');

  const filteredContainers = scope === 'all' ? containers : containers.filter((c) => c.containerId === scope);

  const previews = useMemo<BulkRenamePreview[]>(() => {
    const results: BulkRenamePreview[] = [];

    if (mode === 'replace') {
      if (!find.trim()) return [];
      for (const row of selectedRows) {
        for (const c of filteredContainers) {
          const cell = row.cells[c.containerId];
          if (!cell) continue;
          const cellName = cell.name;
          const flags = caseSensitive ? 'g' : 'gi';
          const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, flags);
          const newName = cellName.replace(regex, replace);
          if (newName !== cellName) {
            results.push({ rowKey: row.key, category: row.category, containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, oldName: cellName, newName });
          }
        }
      }
    } else {
      if (!template.trim()) return [];
      for (const row of selectedRows) {
        for (const c of filteredContainers) {
          const cell = row.cells[c.containerId];
          if (!cell) continue;
          const cellName = cell.name;
          const newName = applyTemplate(template, row, cellName);
          if (newName !== cellName && newName.trim()) {
            results.push({ rowKey: row.key, category: row.category, containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, oldName: cellName, newName });
          }
        }
      }
    }

    return results;
  }, [mode, find, replace, caseSensitive, template, selectedRows, filteredContainers]);

  const inputCls = 'flex-1 px-3 py-2 text-xs rounded-lg border outline-none transition-colors';
  const inputStyle = { borderColor: 'hsl(220 13% 88%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 20%)' };

  function handleConfirm() {
    if (!previews.length) return;
    onConfirm(previews);
    onClose();
  }

  const isEmpty = mode === 'replace' ? !find.trim() : !template.trim();

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'hsl(220 20% 10% / 0.4)' }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div
          className="w-full max-w-2xl flex flex-col rounded-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-rename-title"
          style={{ backgroundColor: 'white', boxShadow: '0 20px 60px hsl(220 20% 10% / 0.15)', border: '1px solid hsl(220 13% 91%)', maxHeight: '85vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid hsl(220 13% 91%)' }}>
            <div>
              <div id="bulk-rename-title" className="text-sm font-semibold text-foreground">Renommer en masse</div>
              <div className="text-xs text-muted-fg mt-0.5">{selectedRows.length} entité{selectedRows.length > 1 ? 's' : ''} sélectionnée{selectedRows.length > 1 ? 's' : ''}</div>
            </div>
            <button onClick={onClose} aria-label="Fermer" className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-fg hover:bg-muted transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex px-5 pt-4 gap-1 shrink-0">
            {([['replace', 'Rechercher / Remplacer'], ['template', 'Modele de nomenclature']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                style={mode === m
                  ? { backgroundColor: 'hsl(267 100% 59% / 0.1)', color: 'hsl(267 85% 45%)', border: '1px solid hsl(267 100% 59% / 0.3)' }
                  : { backgroundColor: 'transparent', color: 'hsl(220 13% 50%)', border: '1px solid transparent' }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="px-5 py-4 space-y-3 shrink-0" style={{ borderBottom: '1px solid hsl(220 13% 91%)' }}>
            {mode === 'replace' ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2">
                    <label htmlFor="bulk-find-input" className="text-[11px] font-semibold text-muted-fg w-16 shrink-0">Trouver</label>
                    <input id="bulk-find-input" type="text" value={find} onChange={(e) => setFind(e.target.value)} placeholder='Ex : "DLV -" ou "GA4 —"' className={inputCls} style={inputStyle} autoFocus />
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-muted-fg" aria-hidden="true">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="flex-1 flex items-center gap-2">
                    <label htmlFor="bulk-replace-input" className="text-[11px] font-semibold text-muted-fg w-16 shrink-0">Remplacer</label>
                    <input id="bulk-replace-input" type="text" value={replace} onChange={(e) => setReplace(e.target.value)} placeholder='Ex : "DL -" ou "GA4 -"' className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-fg">
                  <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="rounded" aria-label="Respecter la casse" />
                  Respecter la casse
                </label>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label htmlFor="bulk-template-input" className="text-[11px] font-semibold text-muted-fg w-16 shrink-0">Modele</label>
                  <input
                    id="bulk-template-input"
                    type="text"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder='Ex : GA4 - {key} ou Piano - {key}'
                    className={inputCls}
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS.map((v) => (
                    <button
                      key={v.token}
                      onClick={() => setTemplate((t) => t + v.token)}
                      title={v.desc}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors"
                      style={{ backgroundColor: 'hsl(220 13% 96%)', color: 'hsl(220 13% 35%)', border: '1px solid hsl(220 13% 88%)' }}
                    >
                      <span style={{ color: 'hsl(267 85% 50%)' }}>{v.token}</span>
                      <span className="font-sans opacity-70">— {v.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Scope */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="bulk-container-select" className="text-[11px] font-semibold text-muted-fg">Container :</label>
              <select
                id="bulk-container-select"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="text-xs rounded-lg border px-2 py-1 outline-none"
                style={{ borderColor: 'hsl(220 13% 88%)', backgroundColor: 'white', color: 'hsl(220 13% 20%)' }}
              >
                <option value="all">Tous ({containers.length})</option>
                {containers.map((c) => (
                  <option key={c.containerId} value={c.containerId}>{c.containerName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview table */}
          <div className="flex-1 overflow-auto px-5 py-3">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-fg text-xs">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" opacity="0.4"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                {mode === 'replace' ? 'Saisissez un texte a trouver pour voir l\'apercu' : 'Saisissez un modele pour voir l\'apercu · ex : GA4 - {key}'}
              </div>
            ) : previews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 gap-1.5">
                <span className="text-xs font-medium" style={{ color: 'hsl(38 92% 50%)' }}>Aucune modification</span>
                <span className="text-[11px] text-muted-fg">
                  {mode === 'replace' ? `"${find}" n'apparait dans aucune des entites selectionnees` : 'Le modele produit les memes noms que l\'existant'}
                </span>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid hsl(220 13% 91%)' }}>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-fg text-[11px]">Container</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-fg text-[11px]">Avant</th>
                    <th className="text-left py-2 font-semibold text-muted-fg text-[11px]">Apres</th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid hsl(220 13% 96%)' }}>
                      <td className="py-2 pr-3 font-mono text-[11px] text-muted-fg whitespace-nowrap">
                        <div className="font-semibold text-foreground">{p.containerName}</div>
                        <div className="opacity-60">{p.publicId}</div>
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px]" style={{ color: 'hsl(0 72% 51%)' }}>
                        {mode === 'replace'
                          ? <HighlightMatch text={p.oldName} find={find} caseSensitive={caseSensitive} />
                          : p.oldName}
                      </td>
                      <td className="py-2 font-mono text-[11px]" style={{ color: 'hsl(142 71% 35%)' }}>
                        {p.newName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid hsl(220 13% 91%)' }}>
            <div className="text-xs text-muted-fg">
              {previews.length > 0 && (
                <span>{previews.length} renommage{previews.length > 1 ? 's' : ''} · ajoutes a la file de deploiement</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={previews.length === 0}
                style={previews.length > 0 ? { backgroundColor: 'hsl(267 100% 59%)', color: 'white', border: 'none' } : {}}
              >
                Appliquer {previews.length > 0 ? `(${previews.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function HighlightMatch({ text, find, caseSensitive }: { text: string; find: string; caseSensitive: boolean }) {
  if (!find) return <>{text}</>;
  const flags = caseSensitive ? 'g' : 'gi';
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, flags));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <mark key={i} style={{ backgroundColor: 'hsl(38 92% 50% / 0.25)', borderRadius: 2 }}>{p}</mark>
          : p
      )}
    </>
  );
}
