import { useState, useMemo } from 'react';
import type { GTMContainer, GTMAccount } from '../../types/gtm';
import { useGTMStore } from '../../store/gtm-store';
import { Button } from '../ui/Button';

interface Props {
  account: GTMAccount;
  selectedContainers: GTMContainer[];
  onClose: () => void;
}

type Mode = 'replace' | 'nomenclature';

// Tokens built-in
const BUILTIN_TOKENS = [
  { token: '{name}',     label: 'Nom actuel',      desc: 'Nom actuel du container ou du compte' },
  { token: '{publicId}', label: 'ID GTM',           desc: 'Identifiant public GTM (ex: GTM-XXXXX)' },
  { token: '{client}',   label: 'Client',           desc: 'Valeur du champ Client ci-dessous' },
  { token: '{env}',      label: 'Environnement',    desc: 'Valeur du champ Environnement ci-dessous' },
  { token: '{lang}',     label: 'Langue / Marché',  desc: 'Valeur du champ Langue ci-dessous' },
  { token: '{type}',     label: 'Type',             desc: 'Type de container (Web, Server, AMP…)' },
];

const ENV_OPTIONS = ['PRD', 'STG', 'DEV', 'QA', 'PROD', 'UAT'];
const TYPE_OPTIONS = ['Web', 'Server', 'AMP', 'iOS', 'Android'];

interface CustomFields {
  client: string;
  env: string;
  lang: string;
  type: string;
}

interface RowState {
  kind: 'account' | 'container';
  id: string;
  publicId?: string;
  oldName: string;
  newName: string;
}

function applyNomenclature(template: string, row: RowState, fields: CustomFields): string {
  return template
    .replace(/\{name\}/g, row.oldName)
    .replace(/\{publicId\}/g, row.publicId ?? '')
    .replace(/\{client\}/g, fields.client)
    .replace(/\{env\}/g, fields.env)
    .replace(/\{lang\}/g, fields.lang)
    .replace(/\{type\}/g, fields.type);
}

const inputCls = 'w-full rounded-lg border px-3 py-1.5 text-sm text-foreground focus:outline-none transition-colors';
const inputStyle = { borderColor: 'hsl(220 13% 88%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 20%)' };

export function BulkRenameModal({ account, selectedContainers, onClose }: Props) {
  const { addContainerRenames } = useGTMStore();

  const [mode, setMode] = useState<Mode>('nomenclature');

  // Replace mode
  const [findText, setFindText]     = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Nomenclature mode
  const [template, setTemplate]   = useState('');
  const [fields, setFields]       = useState<CustomFields>({ client: '', env: 'PRD', lang: '', type: 'Web' });
  const [applyToAccount, setApplyToAccount] = useState(false);

  // Rows (manual overrides after preview)
  const baseRows: RowState[] = useMemo(() => {
    const rows: RowState[] = [
      { kind: 'account', id: account.accountId, oldName: account.name, newName: account.name },
      ...selectedContainers.map((c): RowState => ({
        kind: 'container',
        id: c.containerId,
        publicId: c.publicId,
        oldName: c.name,
        newName: c.name,
      })),
    ];
    return rows;
  }, [account, selectedContainers]);

  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const previewRows: RowState[] = useMemo(() => {
    return baseRows.map((r) => {
      if (overrides[r.id] !== undefined) return { ...r, newName: overrides[r.id] };
      if (r.kind === 'account' && !applyToAccount) return r;

      if (mode === 'replace') {
        if (!findText.trim()) return r;
        const flags = caseSensitive ? 'g' : 'gi';
        const esc = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return { ...r, newName: r.oldName.replace(new RegExp(esc, flags), replaceText) };
      }
      if (mode === 'nomenclature') {
        if (!template.trim()) return r;
        return { ...r, newName: applyNomenclature(template, r, fields) };
      }
      return r;
    });
  }, [baseRows, mode, findText, replaceText, caseSensitive, template, fields, applyToAccount, overrides]);

  const changedRows = previewRows.filter((r) => r.newName.trim() && r.newName !== r.oldName);

  const setOverride = (id: string, val: string) =>
    setOverrides((prev) => ({ ...prev, [id]: val }));

  const handleQueue = () => {
    if (!changedRows.length) return;
    addContainerRenames(
      changedRows.map((r) => ({
        kind: r.kind,
        accountId: account.accountId,
        accountName: account.name,
        containerId: r.kind === 'container' ? r.id : undefined,
        publicId: r.publicId,
        oldName: r.oldName,
        newName: r.newName.trim(),
      }))
    );
    onClose();
  };

  const insertToken = (token: string) => setTemplate((t) => t + token);

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,10,6,0.4)' }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-card flex flex-col rounded-xl w-full"
          style={{ maxWidth: 720, maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,10,6,0.18)', border: '1px solid hsl(220 13% 91%)' }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-bold text-foreground">Renommer en masse</h2>
              <p className="text-xs text-muted-fg mt-0.5">
                {selectedContainers.length} container{selectedContainers.length !== 1 ? 's' : ''} · compte "{account.name}"
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-fg">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex px-6 pt-4 gap-1 shrink-0">
            {([
              ['nomenclature', 'Nomenclature'],
              ['replace',      'Rechercher / Remplacer'],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
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
          <div className="px-6 py-4 space-y-3 shrink-0 border-b border-border">
            {mode === 'replace' ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-fg">Trouver</label>
                    <input type="text" value={findText} onChange={(e) => setFindText(e.target.value)}
                      placeholder='Ex : "Production" ou "GTM -"' className={inputCls} style={inputStyle} autoFocus />
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-5 text-muted-fg opacity-40">
                    <path d="M2 8h12M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-fg">Remplacer par</label>
                    <input type="text" value={replaceText} onChange={(e) => setReplaceText(e.target.value)}
                      placeholder='Nouveau texte…' className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-fg">
                  <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
                  Respecter la casse
                </label>
              </>
            ) : (
              <>
                {/* Custom fields row */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-fg">Client</label>
                    <input type="text" value={fields.client} onChange={(e) => setFields((f) => ({ ...f, client: e.target.value }))}
                      placeholder="Air France" className={inputCls} style={inputStyle} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-fg">Env.</label>
                    <select value={fields.env} onChange={(e) => setFields((f) => ({ ...f, env: e.target.value }))}
                      className={inputCls} style={{ ...inputStyle, width: 'auto' }}>
                      {ENV_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-fg">Langue</label>
                    <input type="text" value={fields.lang} onChange={(e) => setFields((f) => ({ ...f, lang: e.target.value }))}
                      placeholder="FR" className={inputCls} style={inputStyle} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-fg">Type</label>
                    <select value={fields.type} onChange={(e) => setFields((f) => ({ ...f, type: e.target.value }))}
                      className={inputCls} style={{ ...inputStyle, width: 'auto' }}>
                      {TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* Pattern */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-fg">Modele de nom</label>
                  <input
                    type="text"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder='Ex : {client} - {env} - {type} | {publicId}'
                    className={inputCls}
                    style={inputStyle}
                    autoFocus
                  />
                </div>

                {/* Token chips */}
                <div className="flex flex-wrap gap-1.5">
                  {BUILTIN_TOKENS.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertToken(v.token)}
                      title={v.desc}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors hover:opacity-80"
                      style={{ backgroundColor: 'hsl(220 13% 96%)', color: 'hsl(220 13% 35%)', border: '1px solid hsl(220 13% 88%)' }}
                    >
                      <span style={{ color: 'hsl(267 85% 50%)' }}>{v.token}</span>
                      <span className="font-sans opacity-70">— {v.label}</span>
                    </button>
                  ))}
                </div>

                {/* Apply to account toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-fg">
                  <input type="checkbox" checked={applyToAccount} onChange={(e) => setApplyToAccount(e.target.checked)} />
                  Appliquer aussi au nom du compte GTM
                </label>
              </>
            )}
          </div>

          {/* Preview table */}
          <div className="flex-1 overflow-y-auto px-6 py-3">
            {(mode === 'replace' && !findText.trim()) || (mode === 'nomenclature' && !template.trim()) ? (
              <div className="flex flex-col items-center justify-center h-28 gap-2 text-muted-fg text-xs opacity-60">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {mode === 'nomenclature'
                  ? "Saisissez un modele pour voir l'apercu · ex : {client} - {env} - {type}"
                  : "Saisissez un texte a trouver pour voir l'apercu"}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 text-[11px] font-semibold text-muted-fg w-24">Type</th>
                    <th className="text-left py-2 pr-3 text-[11px] font-semibold text-muted-fg">Avant</th>
                    <th className="text-left py-2 text-[11px] font-semibold text-muted-fg">Apres (editable)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => {
                    const changed = row.newName !== row.oldName && row.newName.trim();
                    return (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-2 pr-3">
                          <span
                            className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={row.kind === 'account'
                              ? { backgroundColor: 'hsl(267 100% 59% / 0.12)', color: 'hsl(267 100% 59%)' }
                              : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)' }}
                          >
                            {row.kind === 'account' ? 'Compte' : row.publicId}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-muted-fg max-w-[180px]">
                          <span className="truncate block" title={row.oldName}>{row.oldName}</span>
                        </td>
                        <td className="py-2">
                          <input
                            type="text"
                            value={row.newName}
                            onChange={(e) => setOverride(row.id, e.target.value)}
                            className="w-full rounded-lg border px-2.5 py-1 text-xs text-foreground focus:outline-none transition-colors"
                            style={changed
                              ? { borderColor: 'hsl(267 100% 59% / 0.4)', backgroundColor: 'hsl(267 100% 59% / 0.05)', color: 'hsl(220 13% 15%)' }
                              : { borderColor: 'hsl(220 13% 88%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 50%)' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-fg">
              {changedRows.length > 0
                ? `${changedRows.length} modification${changedRows.length > 1 ? 's' : ''} · ajoutees au plan`
                : 'Aucune modification'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
              <Button size="sm" onClick={handleQueue} disabled={changedRows.length === 0}>
                Ajouter au plan {changedRows.length > 0 ? `(${changedRows.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
