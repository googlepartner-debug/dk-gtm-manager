import { useState } from 'react';
import { useGTMStore } from '../store/gtm-store';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { DeploymentPackage } from '../types/gtm';

const EMPTY_PACKAGE: Omit<DeploymentPackage, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  client: 'PFS',
  entities: { tags: [], variables: [], triggers: [] },
};

function countEntities(pkg: DeploymentPackage) {
  const { tags, variables, triggers } = pkg.entities;
  return tags.length + variables.length + triggers.length;
}

export function PackagesPage() {
  const { packages, upsertPackage, removePackage, selectPackage } = useGTMStore();
  const [editing, setEditing] = useState<DeploymentPackage | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');

  const openNew = () => {
    const pkg: DeploymentPackage = {
      ...EMPTY_PACKAGE,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setEditing(pkg);
    setJsonText(JSON.stringify(pkg.entities, null, 2));
    setJsonError(null);
  };

  const openEdit = (pkg: DeploymentPackage) => {
    setEditing(pkg);
    setJsonText(JSON.stringify(pkg.entities, null, 2));
    setJsonError(null);
  };

  const save = () => {
    if (!editing) return;
    try {
      const entities = JSON.parse(jsonText);
      setJsonError(null);
      upsertPackage({ ...editing, entities });
      setEditing(null);
    } catch (e) {
      setJsonError(`JSON invalide : ${String(e)}`);
    }
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as DeploymentPackage;
        upsertPackage({ ...data, id: data.id ?? crypto.randomUUID() });
      } catch {
        alert('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (editing) {
    return (
      <div className="max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <button className="text-slate-500 hover:text-slate-900" onClick={() => setEditing(null)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            {editing.name ? `Modifier "${editing.name}"` : 'Nouveau package'}
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nom</label>
              <input
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex: GA4 PFS - Event tracking"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Client</label>
              <input
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editing.client}
                onChange={(e) => setEditing({ ...editing, client: e.target.value })}
                placeholder="PFS"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
            <input
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editing.description ?? ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Description optionnelle"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Entités GTM <span className="text-slate-400 font-normal">(JSON — tags, variables, triggers)</span>
            </label>
            <textarea
              className="w-full h-80 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
            />
            {jsonError && (
              <p className="text-xs text-red-600 mt-1">{jsonError}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              Structure attendue : <code className="bg-slate-100 px-1 rounded">{"{ \"tags\": [], \"variables\": [], \"triggers\": [] }"}</code>
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button onClick={save} disabled={!editing.name}>Enregistrer le package</Button>
          <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Packages de déploiement</h1>
          <p className="text-sm text-slate-500 mt-1">Tags, variables et triggers à déployer en batch.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".json" className="hidden" onChange={importFile} />
            <span className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700">
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
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <div className="text-slate-300 text-4xl mb-3">📦</div>
          <p className="text-sm text-slate-500 mb-4">Aucun package encore. Créez-en un ou importez un JSON.</p>
          <Button variant="secondary" onClick={openNew}>Créer mon premier package</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 text-lg">📦</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900 text-sm">{pkg.name}</span>
                  <Badge variant="info">{pkg.client}</Badge>
                  <Badge variant="default">{countEntities(pkg)} entité{countEntities(pkg) !== 1 ? 's' : ''}</Badge>
                </div>
                {pkg.description && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{pkg.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400">
                    {pkg.entities.tags.length} tags · {pkg.entities.variables.length} variables · {pkg.entities.triggers.length} triggers
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${pkg.name.replace(/\s+/g, '_')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Exporter
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openEdit(pkg)}>Modifier</Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    selectPackage(pkg.id);
                    window.location.assign('/dashboard/deploy');
                  }}
                >
                  Déployer
                </Button>
                <button
                  className="text-slate-300 hover:text-red-500 transition-colors p-1"
                  onClick={() => {
                    if (confirm(`Supprimer "${pkg.name}" ?`)) removePackage(pkg.id);
                  }}
                >
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
