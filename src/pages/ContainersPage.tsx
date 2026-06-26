import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/auth-store';
import { useGTMStore } from '../store/gtm-store';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Combobox } from '../components/ui/Combobox';

type SortMode = 'recent' | 'name';

function formatRelativeDate(fingerprintMs: string): string {
  const ts = parseInt(fingerprintMs, 10);
  if (!ts) return '';
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? 's' : ''}`;
}

export function ContainersPage() {
  const { accessToken } = useAuthStore();
  const {
    accounts, selectedAccountId, selectAccount,
    containers, selectedContainerIds, toggleContainer, selectAllContainers, clearContainerSelection,
    isLoadingAccounts, isLoadingContainers, accountError,
  } = useGTMStore();

  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const selectedCount = selectedContainerIds.size;

  const sortedContainers = useMemo(() => {
    const copy = [...containers];
    if (sortMode === 'recent') {
      copy.sort((a, b) => parseInt(b.fingerprint, 10) - parseInt(a.fingerprint, 10));
    } else {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    }
    return copy;
  }, [containers, sortMode]);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Containers GTM</h1>
        <p className="text-sm text-muted-fg mt-1">Sélectionnez les containers cibles pour vos déploiements.</p>
      </div>

      {/* Account selector */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <label className="block text-xs font-semibold text-muted-fg uppercase tracking-wide mb-2">
          Compte GTM
        </label>
        {isLoadingAccounts ? (
          <div className="h-9 bg-muted animate-pulse rounded-lg" />
        ) : accountError ? (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-lg">{accountError}</div>
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
                    onClick={() => setSortMode('recent')}
                    className={`px-2.5 py-1.5 transition-colors ${sortMode === 'recent' ? 'bg-primary text-white' : 'text-muted-fg hover:bg-muted'}`}
                  >
                    Dernière publication
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('name')}
                    className={`px-2.5 py-1.5 transition-colors border-l border-border ${sortMode === 'name' ? 'bg-primary text-white' : 'text-muted-fg hover:bg-muted'}`}
                  >
                    A–Z
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={selectAllContainers}>Tout sélectionner</Button>
              {selectedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearContainerSelection}>Désélectionner</Button>
              )}
            </div>
          </div>

          {isLoadingContainers ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
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
                      <div className="text-xs text-muted-fg mt-0.5">
                        Publié {formatRelativeDate(c.fingerprint)}
                      </div>
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
          <Button size="sm" onClick={() => window.location.assign('/dashboard/deploy')}>
            Aller au déploiement →
          </Button>
        </div>
      )}
    </div>
  );
}
