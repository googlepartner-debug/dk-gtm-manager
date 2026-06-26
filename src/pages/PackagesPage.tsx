import { useState } from 'react';
import { useGTMStore } from '../store/gtm-store';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EntityDrawer } from '../components/packages/EntityDrawer';
import { TAG_TYPES, VARIABLE_TYPES, TRIGGER_TYPES } from '../data/gtm-entity-types';
import type { DeploymentPackage, GTMTag, GTMVariable, GTMTrigger } from '../types/gtm';

type TabKind = 'tags' | 'variables' | 'triggers';
type DrawerKind = 'tag' | 'variable' | 'trigger';

const EMPTY_PACKAGE: Omit<DeploymentPackage, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  client: 'PFS',
  entities: { tags: [], variables: [], triggers: [] },
};

const inputCls = 'w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-fg';

function getTypeLabel(kind: DrawerKind, type: string): string {
  const types = kind === 'tag' ? TAG_TYPES : kind === 'variable' ? VARIABLE_TYPES : TRIGGER_TYPES;
  return types.find((t) => t.id === type)?.label ?? type;
}

// ─── Package Editor ────────────────────────────────────────────────────────────

function PackageEditor({ pkg, onBack }: { pkg: DeploymentPackage; onBack: () => void }) {
  const { upsertPackage } = useGTMStore();
  const [editing, setEditing] = useState(pkg);
  const [activeTab, setActiveTab] = useState<TabKind>('tags');
  const [drawer, setDrawer] = useState<{ kind: DrawerKind; index: number | null } | null>(null);

  function save(updated: DeploymentPackage) {
    setEditing(updated);
    upsertPackage(updated);
  }

  function openAdd(kind: DrawerKind) { setDrawer({ kind, index: null }); }
  function openEdit(kind: DrawerKind, index: number) { setDrawer({ kind, index }); }
  function closeDrawer() { setDrawer(null); }

  function handleSaveEntity(kind: DrawerKind, entity: GTMTag | GTMVariable | GTMTrigger) {
    const key = `${kind}s` as keyof typeof editing.entities;
    const list = [...editing.entities[key]] as (GTMTag | GTMVariable | GTMTrigger)[];
    if (drawer?.index !== null && drawer?.index !== undefined) {
      list[drawer.index] = entity;
    } else {
      list.push(entity);
    }
    save({ ...editing, entities: { ...editing.entities, [key]: list } });
    closeDrawer();
  }

  function removeEntity(kind: DrawerKind, index: number) {
    const key = `${kind}s` as keyof typeof editing.entities;
    const list = [...editing.entities[key]];
    list.splice(index, 1);
    save({ ...editing, entities: { ...editing.entities, [key]: list } });
  }

  const tabs: { id: TabKind; label: string; count: number }[] = [
    { id: 'tags', label: 'Tags', count: editing.entities.tags.length },
    { id: 'variables', label: 'Variables', count: editing.entities.variables.length },
    { id: 'triggers', label: 'Déclencheurs', count: editing.entities.triggers.length },
  ];

  const drawerKind: DrawerKind = activeTab === 'tags' ? 'tag' : activeTab === 'variables' ? 'variable' : 'trigger';
  const currentList = editing.entities[activeTab] as (GTMTag | GTMVariable | GTMTrigger)[];
  const editingEntity = drawer?.index !== null && drawer?.index !== undefined ? currentList[drawer.index] : null;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button className="text-muted-fg hover:text-foreground transition-colors" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-xl font-bold text-foreground flex-1">{editing.name || 'Nouveau package'}</h1>
      </div>

      {/* Package metadata */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-fg mb-1">Nom du package</label>
            <input className={inputCls} value={editing.name} onChange={(e) => save({ ...editing, name: e.target.value })} placeholder="GA4 PFS — Event tracking" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-fg mb-1">Client</label>
            <input className={inputCls} value={editing.client} onChange={(e) => save({ ...editing, client: e.target.value })} placeholder="PFS" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-fg mb-1">Description</label>
          <input className={inputCls} value={editing.description ?? ''} onChange={(e) => save({ ...editing, description: e.target.value })} placeholder="Description optionnelle" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-muted-fg border-transparent hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab.id ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-fg'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Entity list */}
        <div className="p-4">
          {currentList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-fg mb-3">Aucun {drawerKind} dans ce package.</p>
              <Button variant="secondary" size="sm" onClick={() => openAdd(drawerKind)}>
                Ajouter un {drawerKind}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {currentList.map((entity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/3 transition-all cursor-pointer group"
                  onClick={() => openEdit(drawerKind, i)}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-primary">
                    {(() => {
                      const types = drawerKind === 'tag' ? TAG_TYPES : drawerKind === 'variable' ? VARIABLE_TYPES : TRIGGER_TYPES;
                      return types.find((t) => t.id === entity.type)?.icon ?? entity.type.slice(0, 3).toUpperCase();
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{entity.name}</span>
                      <Badge variant="default">{getTypeLabel(drawerKind, entity.type)}</Badge>
                    </div>
                    {drawerKind === 'tag' && (entity as GTMTag).firingTriggerId?.length ? (
                      <div className="text-xs text-muted-fg mt-0.5 truncate">
                        Déclenché par : {(entity as GTMTag).firingTriggerId!.join(', ')}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1.5 text-muted-fg hover:text-foreground transition-colors rounded"
                      onClick={(e) => { e.stopPropagation(); openEdit(drawerKind, i); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M9 2l2 2-7 7H2V9l7-7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className="p-1.5 text-muted-fg hover:text-destructive transition-colors rounded"
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer "${entity.name}" ?`)) removeEntity(drawerKind, i); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2 3.5h9M4.5 3.5V2.5h4v1M5 6v4M8 6v4M2.5 3.5l.5 8h7l.5-8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add button */}
        {currentList.length > 0 && (
          <div className="px-4 pb-4">
            <button
              onClick={() => openAdd(drawerKind)}
              className="w-full py-2 text-sm text-primary border border-dashed border-primary/30 rounded-lg hover:bg-primary/5 hover:border-primary/50 transition-all flex items-center justify-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Ajouter un {drawerKind}
            </button>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawer && (
        <EntityDrawer
          kind={drawerKind}
          entity={editingEntity}
          availableTriggers={editing.entities.triggers}
          onSave={(entity) => handleSaveEntity(drawerKind, entity)}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

// ─── Package List ──────────────────────────────────────────────────────────────

function countEntities(pkg: DeploymentPackage) {
  const { tags, variables, triggers } = pkg.entities;
  return tags.length + variables.length + triggers.length;
}

export function PackagesPage() {
  const { packages, upsertPackage, removePackage, selectPackage } = useGTMStore();
  const [editingPkg, setEditingPkg] = useState<DeploymentPackage | null>(null);

  function openNew() {
    const pkg: DeploymentPackage = { ...EMPTY_PACKAGE, id: crypto.randomUUID(), createdAt: new Date().toISOString(), entities: { tags: [], variables: [], triggers: [] } };
    upsertPackage(pkg);
    setEditingPkg(pkg);
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as DeploymentPackage;
        const pkg = { ...data, id: data.id ?? crypto.randomUUID() };
        upsertPackage(pkg);
        setEditingPkg(pkg);
      } catch { alert('Fichier JSON invalide'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  if (editingPkg) {
    return <PackageEditor pkg={editingPkg} onBack={() => setEditingPkg(null)} />;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Packages de déploiement</h1>
          <p className="text-sm text-muted-fg mt-1">Tags, variables et déclencheurs à déployer en batch.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".json" className="hidden" onChange={importFile} />
            <span className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold bg-card border border-border rounded-lg hover:bg-muted transition-colors text-foreground cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M4 6l3 3 3-3M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Importer JSON
            </span>
          </label>
          <Button onClick={openNew}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Nouveau package
          </Button>
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="4" width="18" height="6" rx="2" fill="currentColor" className="text-primary" opacity="0.7"/>
              <rect x="2" y="12" width="18" height="6" rx="2" fill="currentColor" className="text-primary" opacity="0.3"/>
            </svg>
          </div>
          <p className="text-sm text-muted-fg mb-4">Aucun package encore. Créez-en un ou importez un JSON.</p>
          <Button variant="secondary" onClick={openNew}>Créer mon premier package</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-shadow">
              <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="3" width="16" height="5" rx="1.5" fill="currentColor" className="text-primary" opacity="0.7"/>
                  <rect x="1" y="10" width="16" height="5" rx="1.5" fill="currentColor" className="text-primary" opacity="0.35"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">{pkg.name || 'Package sans nom'}</span>
                  <Badge variant="info">{pkg.client}</Badge>
                  <Badge variant="default">{countEntities(pkg)} entité{countEntities(pkg) !== 1 ? 's' : ''}</Badge>
                </div>
                {pkg.description && <p className="text-xs text-muted-fg mt-0.5 truncate">{pkg.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-fg">
                    {pkg.entities.tags.length} tags · {pkg.entities.variables.length} variables · {pkg.entities.triggers.length} déclencheurs
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={() => {
                  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `${(pkg.name || 'package').replace(/\s+/g, '_')}.json`; a.click();
                  URL.revokeObjectURL(url);
                }}>Exporter</Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingPkg(pkg)}>Modifier</Button>
                <Button size="sm" onClick={() => { selectPackage(pkg.id); window.location.assign('/dashboard/deploy'); }}>Déployer</Button>
                <button className="text-border hover:text-destructive transition-colors p-1" onClick={() => { if (confirm(`Supprimer "${pkg.name}" ?`)) removePackage(pkg.id); }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 3.5h10M5 3.5V2.5h4v1M5.5 6v4M8.5 6v4M3 3.5l.5 8.5h7l.5-8.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
