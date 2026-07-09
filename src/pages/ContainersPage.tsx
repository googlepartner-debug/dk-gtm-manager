import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { useGTMStore } from '../store/gtm-store';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Combobox } from '../components/ui/Combobox';
import { BulkRenameModal } from '../components/containers/BulkRenameModal';

type SortMode = 'api' | 'name' | 'published';

function formatPublicationDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ContainersPage() {
  const { accessToken } = useAuthStore();
  const {
    accounts, selectedAccountId, selectAccount, fetchAccounts,
    containers, selectedContainerIds, toggleContainer, selectAllContainers, clearContainerSelection,
    isLoadingAccounts, isLoadingContainers, accountError,
    pendingContainerRenames, removeContainerRename, clearContainerRenames,
    applyContainerRenames, isApplyingContainerRenames,
  } = useGTMStore();

  const navigate = useNavigate();
  const [sortMode, setSortMode] = useState<SortMode>('api');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameErrorNotif, setRenameErrorNotif] = useState<string | null>(null);
  const pendingRenamesOnly = pendingContainerRenames.filter((op) => op.status === 'pending');

  async function handleApplyContainerRenames() {
    if (!accessToken) { setRenameErrorNotif('Session GTM expirée ou absente — reconnecte-toi puis réessaie.'); return; }
    setRenameErrorNotif(null);
    await applyContainerRenames(accessToken);
    const errs = useGTMStore.getState().applyPublishErrors;
    if (errs.length > 0) setRenameErrorNotif(`${errs.length} renommage(s) en échec — ${errs[0].error.slice(0, 140)}`);
  }

  // Derived — déclarés avant tout usage
  const account = accounts.find((a) => a.accountId === selectedAccountId);
  const selectedCount = selectedContainerIds.size;
  const selectedContainersList = containers.filter((c) => selectedContainerIds.has(c.containerId));

  const LOADING_MESSAGES = [
    `Connexion à l'API GTM…`,
    `Récupération des containers${account ? ` de ${account.name}` : ''}…`,
    `L'API GTM prend son café. On attend.`,
    `Tes containers font du yoga, ils arrivent`,
    `Voilà ! (Google avait juste besoin d'un peu d'amour)`,
    `Google réfléchit encore… c'est un grand penseur`,
    `On reste là, avec toi, jusqu'au bout`,
    `Presque là. Pour de vrai cette fois.`,
  ];

  const sortedContainers = sortMode === 'name'
    ? [...containers].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
    : sortMode === 'published'
    ? [...containers].sort((a, b) => {
        const ta = a.publicationDate ? new Date(a.publicationDate).getTime() : 0;
        const tb = b.publicationDate ? new Date(b.publicationDate).getTime() : 0;
        return tb - ta; // most recent first
      })
    : containers;

  useEffect(() => {
    fetchAccounts(accessToken ?? undefined);
  }, [accessToken]);

  // Auto-restore last account: if we have a selectedAccountId from a previous session
  // but no containers loaded yet, trigger the fetch automatically
  useEffect(() => {
    if (selectedAccountId && containers.length === 0 && !isLoadingContainers && !isLoadingAccounts) {
      selectAccount(selectedAccountId, accessToken ?? undefined);
    }
  }, [selectedAccountId, isLoadingAccounts]);

  useEffect(() => {
    if (!isLoadingContainers) { setLoadingMsgIdx(0); return; }
    setLoadingMsgIdx(0);
    const intervals = [1800, 3500, 6000, 9000, 12000, 16000, 20000];
    const timers = intervals.map((delay, i) =>
      setTimeout(() => setLoadingMsgIdx(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [isLoadingContainers]);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Containers GTM</h1>
          <p className="text-sm text-muted-fg mt-1">Sélectionnez les containers cibles pour vos déploiements.</p>
        </div>
        {selectedCount > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-primary font-semibold">
              {selectedCount} container{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
            </span>
            <Button size="sm" onClick={() => navigate('/dashboard/deploy')}>
              Aller au déploiement →
            </Button>
          </div>
        )}
      </div>

      {/* Account selector */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-2">
          Compte GTM
        </label>
        {isLoadingAccounts ? (
          <div className="h-9 bg-muted animate-pulse rounded-lg" />
        ) : accountError ? (
          <div className="space-y-2">
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-lg">
              {accountError.includes('503') || accountError.includes('502')
                ? "L'API GTM est temporairement indisponible (503). Réessayez dans quelques secondes."
                : accountError}
            </div>
            {selectedAccountId && (
              <Button size="sm" variant="secondary" onClick={() => selectAccount(selectedAccountId, accessToken ?? undefined)}>
                Réessayer
              </Button>
            )}
          </div>
        ) : (
          <Combobox
            options={accounts.map((a) => ({ value: a.accountId, label: a.name }))}
            value={selectedAccountId ?? ''}
            onChange={(val) => selectAccount(val, accessToken ?? undefined)}
            placeholder="Rechercher un compte…"
          />
        )}
      </div>

      {/* Containers list */}
      {selectedAccountId && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {isLoadingContainers ? 'Chargement…' : `${containers.length} container${containers.length !== 1 ? 's' : ''}`}
              </span>
              {selectedCount > 0 && (
                <Badge variant="info">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Sort toggle */}
              {!isLoadingContainers && containers.length > 0 && (
                <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setSortMode('api')}
                    className={`px-2.5 py-1.5 transition-colors ${sortMode === 'api' ? 'bg-primary text-white' : 'text-muted-fg hover:bg-muted'}`}
                  >
                    Ordre GTM
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('name')}
                    className={`px-2.5 py-1.5 transition-colors border-l border-border ${sortMode === 'name' ? 'bg-primary text-white' : 'text-muted-fg hover:bg-muted'}`}
                  >
                    A–Z
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('published')}
                    className={`px-2.5 py-1.5 transition-colors border-l border-border ${sortMode === 'published' ? 'bg-primary text-white' : 'text-muted-fg hover:bg-muted'}`}
                  >
                    Dernière publication
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={selectAllContainers}>Tout sélectionner</Button>
              {selectedCount > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={clearContainerSelection}>Désélectionner</Button>
                  <Button variant="secondary" size="sm" onClick={() => setRenameModalOpen(true)}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginRight: 4 }}>
                      <path d="M2 9.5L9 2.5l1.5 1.5-7 7H2V9.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                      <path d="M7.5 4l1.5 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                    Renommer
                  </Button>
                </>
              )}
            </div>
          </div>

          {isLoadingContainers ? (
            <div>
              {/* Message de chargement */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <svg className="shrink-0 text-primary" style={{ animation: 'dk-spin 0.8s linear infinite' }} width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 8" />
                </svg>
                <span className="text-sm text-muted-fg transition-all duration-500">
                  {LOADING_MESSAGES[Math.min(loadingMsgIdx, LOADING_MESSAGES.length - 1)]}
                </span>
              </div>
              {/* Fausses lignes shimmer */}
              {[
                { nameW: 'w-48', badgeW: 'w-24' },
                { nameW: 'w-36', badgeW: 'w-20' },
                { nameW: 'w-56', badgeW: 'w-28' },
                { nameW: 'w-40', badgeW: 'w-22' },
                { nameW: 'w-52', badgeW: 'w-24' },
                { nameW: 'w-32', badgeW: 'w-20' },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <div className="w-4 h-4 rounded border-2 border-border shrink-0 dk-shimmer" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-3.5 rounded-full dk-shimmer ${row.nameW}`} />
                      <div className={`h-5 rounded-md dk-shimmer ${row.badgeW}`} />
                    </div>
                    <div className="h-2.5 rounded-full dk-shimmer w-24" />
                  </div>
                  <div className="h-3 rounded-full dk-shimmer w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : containers.length === 0 ? (
            <div className="text-center py-12 text-muted-fg text-sm">
              Aucun container dans ce compte.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sortedContainers.map((c) => {
                const isSelected = selectedContainerIds.has(c.containerId);
                return (
                  <li
                    key={c.containerId}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleContainer(c.containerId)}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-primary bg-primary' : 'border-border bg-card'
                      }`}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                        <Badge variant="default">{c.publicId}</Badge>
                        {c.usageContext?.includes('server') && (
                          <Badge variant="info">server-side</Badge>
                        )}
                      </div>
                      {c.publicationDate && (
                        <div className="text-[11px] text-muted-fg mt-0.5">
                          Publié {formatPublicationDate(c.publicationDate)}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-fg font-mono shrink-0">{c.containerId}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* CTA */}
      {selectedCount > 0 && (
        <div className="mt-4 p-4 bg-primary/8 border border-primary/20 rounded-xl flex items-center justify-between">
          <span className="text-sm text-primary font-semibold">
            {selectedCount} container{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''} — prêt à déployer
          </span>
          <Button size="sm" onClick={() => navigate('/dashboard/deploy')}>
            Aller au déploiement →
          </Button>
        </div>
      )}

      {/* Rename plan */}
      {pendingContainerRenames.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">
              Plan de renommage
              <span className="ml-2 text-xs font-normal text-muted-fg">({pendingContainerRenames.length} opération{pendingContainerRenames.length > 1 ? 's' : ''})</span>
            </h2>
            <button
              type="button"
              onClick={clearContainerRenames}
              className="text-xs text-muted-fg hover:text-destructive transition-colors"
            >
              Tout effacer
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <ul className="divide-y divide-border">
              {pendingContainerRenames.map((op) => (
                <li key={op.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={
                      op.kind === 'account'
                        ? { backgroundColor: 'hsl(267 100% 59% / 0.12)', color: 'hsl(267 100% 59%)' }
                        : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 40%)' }
                    }
                  >
                    {op.kind === 'account' ? 'Compte' : op.publicId}
                  </span>
                  <span className="text-sm text-muted-fg truncate max-w-[180px]">{op.oldName}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-muted-fg opacity-40">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm font-medium text-foreground flex-1">{op.newName}</span>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full" style={
                    op.status === 'applied' ? { backgroundColor: 'hsl(142 60% 93%)', color: 'hsl(142 50% 30%)' }
                    : op.status === 'failed' ? { backgroundColor: 'hsl(0 85% 94%)', color: 'hsl(0 65% 45%)' }
                    : { backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 45%)' }
                  } title={op.error}>
                    {op.status === 'applied' ? 'Renommé' : op.status === 'failed' ? 'Échec' : 'en attente'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeContainerRename(op.id)}
                    className="shrink-0 p-1 rounded text-muted-fg hover:text-destructive transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {renameErrorNotif && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'hsl(0 85% 96%)', color: 'hsl(0 65% 40%)' }}>
              {renameErrorNotif}
            </div>
          )}

          {pendingRenamesOnly.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={handleApplyContainerRenames} disabled={isApplyingContainerRenames || !accessToken}
                title={!accessToken ? 'Session GTM expirée — reconnecte-toi' : undefined}>
                {isApplyingContainerRenames ? 'Application…' : `Appliquer ${pendingRenamesOnly.length} renommage${pendingRenamesOnly.length > 1 ? 's' : ''}`}
              </Button>
              <span className="text-xs text-muted-fg">Renomme directement le compte/container sur GTM — pas de version à publier.</span>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {renameModalOpen && account && (
        <BulkRenameModal
          account={account}
          selectedContainers={selectedContainersList}
          onClose={() => setRenameModalOpen(false)}
        />
      )}
    </div>
  );
}
