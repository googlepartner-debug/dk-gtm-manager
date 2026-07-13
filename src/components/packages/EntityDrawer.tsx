import { useState, useEffect } from 'react';
import type { GTMTag, GTMVariable, GTMTrigger } from '../../types/gtm';
import {
  TAG_TYPES, VARIABLE_TYPES, TRIGGER_TYPES,
  paramsToForm, formToParams,
  type EntityTypeDef, type FormValues,
} from '../../data/gtm-entity-types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

type EntityKind = 'tag' | 'variable' | 'trigger';

interface EntityDrawerProps {
  kind: EntityKind;
  entity?: GTMTag | GTMVariable | GTMTrigger | null;
  availableTriggers?: GTMTrigger[];
  onSave: (entity: GTMTag | GTMVariable | GTMTrigger) => void;
  onClose: () => void;
}

const KIND_TYPES: Record<EntityKind, EntityTypeDef[]> = {
  tag: TAG_TYPES,
  variable: VARIABLE_TYPES,
  trigger: TRIGGER_TYPES,
};

const KIND_LABELS: Record<EntityKind, string> = {
  tag: 'tag',
  variable: 'variable',
  trigger: 'déclencheur',
};

const inputCls = 'w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-fg transition-colors';
const textareaCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-fg resize-y transition-colors';

export function EntityDrawer({ kind, entity, availableTriggers = [], onSave, onClose }: EntityDrawerProps) {
  const types = KIND_TYPES[kind];
  const [name, setName] = useState(entity?.name ?? '');
  const [selectedType, setSelectedType] = useState<string>(entity?.type ?? '');
  const [form, setForm] = useState<FormValues>({});
  const [firingTriggerNames, setFiringTriggerNames] = useState<string[]>([]);
  const [groupTriggerNames, setGroupTriggerNames] = useState<string[]>([]);

  useEffect(() => {
    if (entity) {
      setName(entity.name);
      setSelectedType(entity.type);
      setForm(paramsToForm(entity.parameter));
      if ('firingTriggerId' in entity && entity.firingTriggerId) {
        setFiringTriggerNames(entity.firingTriggerId);
      }
    }
  }, [entity]);

  const typeDef = types.find((t) => t.id === selectedType);

  function setField(key: string, value: string | boolean | { name: string; value: string }[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!name.trim() || !selectedType || !typeDef) return;
    const params = formToParams(form, typeDef.fields);
    if (kind === 'tag') {
      onSave({ name: name.trim(), type: selectedType, parameter: params, firingTriggerId: firingTriggerNames });
    } else if (kind === 'variable') {
      onSave({ name: name.trim(), type: selectedType, parameter: params });
    } else {
      const base: GTMTrigger = { name: name.trim(), type: selectedType, parameter: params };
      if (selectedType === 'customEvent') {
        const customEventFilter = String(form['customEventFilter'] ?? '');
        if (customEventFilter) {
          base.customEventFilter = [{
            type: 'equals',
            parameter: [
              { type: 'template', key: 'arg0', value: '{{_event}}' },
              { type: 'template', key: 'arg1', value: customEventFilter },
            ],
          }];
        }
      }
      if (selectedType === 'tgg' && groupTriggerNames.length > 0) {
        // Store constituent trigger names as a list parameter — resolved to IDs at deploy time
        base.parameter = [
          ...(base.parameter ?? []).filter((p) => p.key !== 'triggerIds'),
          {
            type: 'list',
            key: 'triggerIds',
            list: groupTriggerNames.map((n) => ({ type: 'template', key: 'triggerReference', value: n })),
          },
        ];
      }
      onSave(base);
    }
  }

  const canSave = name.trim().length > 0 && selectedType.length > 0;

  // Group types by category
  const grouped = types.reduce<Record<string, EntityTypeDef[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[520px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <button onClick={onClose} className="text-muted-fg hover:text-foreground hover:bg-muted rounded-lg p-1 -m-1 transition-colors shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <input
            className="flex-1 text-base font-semibold text-foreground bg-transparent border-none outline-none placeholder:text-muted-fg/60"
            placeholder={`Nom du ${KIND_LABELS[kind]}…`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!entity}
          />
          {selectedType && (
            <Badge variant="info" className="shrink-0">{typeDef?.label ?? selectedType}</Badge>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* Step 1 — Type selection */}
          {!selectedType ? (
            <div className="p-5">
              <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide mb-4">
                Choisissez un type pour commencer
              </p>
              <div className="space-y-4">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs text-muted-fg mb-2">{category}</p>
                    <div className="space-y-1">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedType(t.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            {t.icon}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{t.label}</div>
                            <div className="text-xs text-muted-fg">{t.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-6">

              {/* Type change */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Configuration du {KIND_LABELS[kind]}</p>
                  <button
                    onClick={() => { setSelectedType(''); setForm({}); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Changer de type
                  </button>
                </div>
              </div>

              {/* Fields */}
              {typeDef && typeDef.fields.length > 0 && (
                <div className="space-y-4">
                  {typeDef.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-muted-fg mb-1.5">
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </label>

                      {field.fieldType === 'text' && (
                        <input
                          className={inputCls}
                          value={String(form[field.key] ?? '')}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                        />
                      )}

                      {field.fieldType === 'textarea' && (
                        <textarea
                          className={`${textareaCls} h-32 ${field.monospace ? 'font-mono text-xs' : ''}`}
                          value={String(form[field.key] ?? '')}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                        />
                      )}

                      {field.fieldType === 'boolean' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <div
                            className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${form[field.key] === true ? 'bg-primary' : 'bg-border'}`}
                            style={{ width: 32, height: 18 }}
                            onClick={() => setField(field.key, form[field.key] !== true)}
                          >
                            <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${form[field.key] === true ? 'translate-x-4' : 'translate-x-0.5'}`} style={{width:14, height:14}} />
                          </div>
                          <span className="text-sm text-foreground">Activé</span>
                        </label>
                      )}

                      {field.fieldType === 'select' && (
                        <select
                          className={inputCls}
                          value={String(form[field.key] ?? '')}
                          onChange={(e) => setField(field.key, e.target.value)}
                        >
                          <option value="">— Choisir —</option>
                          {field.options?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}

                      {field.fieldType === 'params-list' && (
                        <ParamsList
                          value={(form[field.key] as { name: string; value: string }[]) ?? []}
                          onChange={(v) => setField(field.key, v)}
                        />
                      )}

                      {field.fieldType === 'trigger-ids-list' && (
                        <div className="space-y-1">
                          {availableTriggers.filter((t) => t.type !== 'tgg').length === 0 ? (
                            <p className="text-xs text-muted-fg bg-muted rounded-lg px-4 py-3">
                              Aucun déclencheur disponible — créez d'abord des déclencheurs dans ce package.
                            </p>
                          ) : (
                            availableTriggers.filter((t) => t.type !== 'tgg').map((t) => {
                              const isSel = groupTriggerNames.includes(t.name);
                              return (
                                <label key={t.name} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${isSel ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted'}`}>
                                  <div
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSel ? 'border-primary bg-primary' : 'border-border'}`}
                                    onClick={() => setGroupTriggerNames((prev) => isSel ? prev.filter((n) => n !== t.name) : [...prev, t.name])}
                                  >
                                    {isSel && (
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                                    <span className="text-xs text-muted-fg ml-2">{TRIGGER_TYPES.find((tt) => tt.id === t.type)?.label ?? t.type}</span>
                                  </div>
                                </label>
                              );
                            })
                          )}
                          {groupTriggerNames.length >= 2 && (
                            <p className="text-xs mt-2" style={{ color: 'hsl(142 71% 35%)' }}>
                              {groupTriggerNames.length} déclencheurs combinés — le groupe se déclenche uniquement quand TOUS sont actifs.
                            </p>
                          )}
                        </div>
                      )}

                      {field.hint && (
                        <p className="text-xs text-muted-fg mt-1">{field.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {typeDef && typeDef.fields.length === 0 && (
                <div className="text-sm text-muted-fg bg-muted rounded-lg px-4 py-3">
                  Ce type ne nécessite pas de configuration supplémentaire.
                </div>
              )}

              {/* Triggering section — tags only */}
              {kind === 'tag' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-fg uppercase tracking-wide">Déclenchement</p>
                  </div>
                  {availableTriggers.length === 0 ? (
                    <div className="text-xs text-muted-fg bg-muted rounded-lg px-4 py-3">
                      Aucun déclencheur dans ce package. Créez d'abord des déclencheurs.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {availableTriggers.map((t) => {
                        const isSelected = firingTriggerNames.includes(t.name);
                        return (
                          <label key={t.name} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-border'}`}
                              onClick={() => {
                                setFiringTriggerNames(prev =>
                                  isSelected ? prev.filter(n => n !== t.name) : [...prev, t.name]
                                );
                              }}
                            >
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-foreground">{t.name}</span>
                              <span className="text-xs text-muted-fg ml-2">{TRIGGER_TYPES.find(tt => tt.id === t.type)?.label ?? t.type}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-3 shrink-0">
          <Button onClick={handleSave} disabled={!canSave}>
            Enregistrer
          </Button>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </>
  );
}

// ─── ParamsList ────────────────────────────────────────────────────────────────

function ParamsList({ value, onChange }: { value: { name: string; value: string }[]; onChange: (v: { name: string; value: string }[]) => void }) {
  function updateRow(i: number, field: 'name' | 'value', val: string) {
    const updated = value.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(updated);
  }
  function addRow() { onChange([...value, { name: '', value: '' }]); }
  function removeRow(i: number) { onChange(value.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_28px] gap-1.5 text-xs text-muted-fg px-1 mb-1">
          <span>Nom du paramètre</span>
          <span>Valeur</span>
          <span />
        </div>
      )}
      {value.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-1.5 items-center">
          <input
            className={inputCls}
            value={row.name}
            onChange={(e) => updateRow(i, 'name', e.target.value)}
            placeholder="item_id"
          />
          <input
            className={inputCls}
            value={row.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
            placeholder="{{dlv - item_id}}"
          />
          <button
            onClick={() => removeRow(i)}
            className="w-7 h-7 flex items-center justify-center text-border hover:text-destructive transition-colors rounded"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Ajouter un paramètre
      </button>
    </div>
  );
}
