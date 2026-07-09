import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';
import { useGTMStore } from '../../store/gtm-store';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { DiffEntity, EntityStatus } from '../../types/gtm';

const STATUS_LABEL: Record<EntityStatus, string> = {
  new: 'Nouveau', modified: 'Modifié', unchanged: 'Inchangé', removed: 'Supprimé',
};
const STATUS_BADGE: Record<EntityStatus, 'success' | 'warning' | 'default' | 'error'> = {
  new: 'success', modified: 'warning', unchanged: 'default', removed: 'error',
};
const KIND_LABEL = { tag: 'Tag', variable: 'Variable', trigger: 'Déclencheur' };

function EntityDiffRow({ entity }: { entity: DiffEntity }) {
  const { toggleVersionDiffEntity } = useGTMStore();
  const isRemoved = entity.status === 'removed';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 transition-colors ${isRemoved ? 'opacity-60' : 'hover:bg-muted cursor-pointer'}`}
      onClick={isRemoved ? undefined : () => toggleVersionDiffEntity(entity.key)}
      title={isRemoved ? "Une suppression n'est jamais incluse dans le package — action séparée et explicite (ex. Nettoyage) sur les containers cibles" : undefined}
    >
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          isRemoved ? 'border-border bg-muted cursor-not-allowed' : entity.selected ? 'border-primary bg-primary' : 'border-border bg-card'
        }`}
      >
        {entity.selected && !isRemoved && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold shrink-0 bg-primary/10 text-primary">
        {KIND_LABEL[entity.kind]}
      </span>
      <span className="text-sm text-foreground flex-1 truncate font-medium">{entity.name}</span>
      <Badge variant={STATUS_BADGE[entity.status]}>{STATUS_LABEL[entity.status]}</Badge>
    </div>
  );
}

export function VersionDiffFlow({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const {
    containers, selectedAccountId,
    versionHeaders, isLoadingVersionHeaders, loadVersionHeaders,
    versionDiffEntities, isDiffingVersions, versionDiffError, computeVersionDiff,
    selectAllVersionDiffEntities, clearVersionDiff, createPackageFromVersionDiff,
  } = useGTMStore();

  const [containerId, setContainerId] = useState('');
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packageClient, setPackageClient] = useState('PFS');

  const container = containers.find((c) => c.containerId === containerId);

  async function handleSelectContainer(id: string) {
    setContainerId(id);
    setBeforeId('');
    setAfterId('');
    clearVersionDiff();
    if (id && accessToken) await loadVersionHeaders(accessToken, id);
  }

  async function handleCompare() {
    if (!accessToken || !containerId || !beforeId || !afterId) return;
    await computeVersionDiff(accessToken, containerId, beforeId, afterId);
    const beforeName = versionHeaders.find((v) => v.containerVersionId === beforeId)?.name ?? beforeId;
    const afterName = versionHeaders.find((v) => v.containerVersionId === afterId)?.name ?? afterId;
    setPackageName(`Diff — ${container?.name ?? containerId} — v${beforeName} → v${afterName}`);
  }

  function handleCreatePackage() {
    if (!packageName.trim()) return;
    const id = createPackageFromVersionDiff(packageName.trim(), packageClient.trim() || undefined);
    onDone();
    navigate('/dashboard/packages');
    // Best-effort: the package list will show it; user opens it from there to review/deploy.
    void id;
  }

  const entities = versionDiffEntities ?? [];
  const selectedCount = entities.filter((e) => e.selected).length;
  const newCount = entities.filter((e) => e.status === 'new').length;
  const modCount = entities.filter((e) => e.status === 'modified').length;
  const removedCount = entities.filter((e) => e.status === 'removed').length;
  const unchangedCount = entities.filter((e) => e.status === 'unchanged').length;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button className="text-muted-fg hover:text-foreground transition-colors" onClick={() => { clearVersionDiff(); onDone(); }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Comparer deux versions</h1>
          <p className="text-sm text-muted-fg mt-0.5">
            Isole le delta exact entre deux versions publiées d'un container pilote, pour le répliquer ailleurs.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1">Container pilote</label>
          <select className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={containerId} onChange={(e) => handleSelectContainer(e.target.value)} disabled={!selectedAccountId}>
            <option value="">— Choisir un container —</option>
            {containers.map((c) => <option key={c.containerId} value={c.containerId}>{c.name} ({c.publicId})</option>)}
          </select>
        </div>

        {containerId && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1">Version avant</label>
              <select className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={beforeId} onChange={(e) => setBeforeId(e.target.value)} disabled={isLoadingVersionHeaders}>
                <option value="">{isLoadingVersionHeaders ? 'Chargement…' : '— Choisir —'}</option>
                {versionHeaders.map((v) => <option key={v.containerVersionId} value={v.containerVersionId}>{v.name || `Version ${v.containerVersionId}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1">Version après</label>
              <select className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={afterId} onChange={(e) => setAfterId(e.target.value)} disabled={isLoadingVersionHeaders}>
                <option value="">{isLoadingVersionHeaders ? 'Chargement…' : '— Choisir —'}</option>
                {versionHeaders.map((v) => <option key={v.containerVersionId} value={v.containerVersionId}>{v.name || `Version ${v.containerVersionId}`}</option>)}
              </select>
            </div>
          </div>
        )}

        <Button size="sm" disabled={!beforeId || !afterId || beforeId === afterId || isDiffingVersions} loading={isDiffingVersions} onClick={handleCompare}>
          Comparer
        </Button>
        {beforeId && afterId && beforeId === afterId && (
          <p className="text-xs text-destructive">Choisis deux versions différentes.</p>
        )}
      </div>

      {versionDiffError && (
        <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-4 text-sm text-destructive mb-4">
          {versionDiffError}
        </div>
      )}

      {entities.length > 0 && (
        <>
          <div className="bg-card border border-border rounded-xl p-4 mb-4 flex items-center gap-6 flex-wrap">
            <div className="text-center"><div className="text-2xl font-extrabold text-success">{newCount}</div><div className="text-xs text-muted-fg">nouveau{newCount > 1 ? 'x' : ''}</div></div>
            <div className="text-center"><div className="text-2xl font-extrabold text-warning">{modCount}</div><div className="text-xs text-muted-fg">modifié{modCount > 1 ? 's' : ''}</div></div>
            <div className="text-center"><div className="text-2xl font-extrabold text-destructive">{removedCount}</div><div className="text-xs text-muted-fg">supprimé{removedCount > 1 ? 's' : ''}</div></div>
            <div className="text-center"><div className="text-2xl font-extrabold text-muted-fg">{unchangedCount}</div><div className="text-xs text-muted-fg">inchangé{unchangedCount > 1 ? 's' : ''}</div></div>
            <div className="ml-auto text-right">
              <div className="text-sm font-semibold text-primary">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</div>
              <button className="text-xs text-primary hover:underline" onClick={selectAllVersionDiffEntities}>Tout sélectionner</button>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden mb-4">
            {entities.map((entity) => <EntityDiffRow key={entity.key} entity={entity} />)}
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1">Nom du package</label>
              <input className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={packageName} onChange={(e) => setPackageName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-1">Client <span className="normal-case font-normal opacity-60">(optionnel)</span></label>
              <input className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={packageClient} onChange={(e) => setPackageClient(e.target.value)} />
            </div>
            <Button className="w-full" disabled={selectedCount === 0 || !packageName.trim()} onClick={handleCreatePackage}>
              {`Créer le package — ${selectedCount} entité${selectedCount > 1 ? 's' : ''}`}
            </Button>
            <p className="text-xs text-muted-fg">Le package est créé vide de suppressions — tu pourras le réviser et le déployer sur les autres containers via le flux Diff habituel.</p>
          </div>
        </>
      )}
    </div>
  );
}
