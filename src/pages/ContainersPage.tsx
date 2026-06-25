import { useAuthStore } from '../store/auth-store';
import { useGTMStore } from '../store/gtm-store';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export function ContainersPage() {
  const { accessToken } = useAuthStore();
  const {
    accounts, selectedAccountId, selectAccount,
    containers, selectedContainerIds, toggleContainer, selectAllContainers, clearContainerSelection,
    isLoadingAccounts, isLoadingContainers, accountError,
  } = useGTMStore();

  const selectedCount = selectedContainerIds.size;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Containers GTM</h1>
        <p className="text-sm text-slate-500 mt-1">Sélectionnez les containers cibles pour vos déploiements.</p>
      </div>

      {/* Account selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Compte GTM
        </label>
        {isLoadingAccounts ? (
          <div className="h-9 bg-slate-100 animate-pulse rounded-lg" />
        ) : accountError ? (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{accountError}</div>
        ) : (
          <select
            className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedAccountId ?? ''}
            onChange={(e) => {
              if (e.target.value && accessToken) selectAccount(e.target.value, accessToken);
            }}
          >
            <option value="">— Choisir un compte —</option>
            {accounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>{a.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Containers list */}
      {selectedAccountId && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">
                {isLoadingContainers ? 'Chargement…' : `${containers.length} container${containers.length !== 1 ? 's' : ''}`}
              </span>
              {selectedCount > 0 && (
                <Badge variant="info">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllContainers}>Tout sélectionner</Button>
              {selectedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearContainerSelection}>Désélectionner</Button>
              )}
            </div>
          </div>

          {isLoadingContainers ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : containers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Aucun container dans ce compte.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {containers.map((c) => {
                const isSelected = selectedContainerIds.has(c.containerId);
                return (
                  <li
                    key={c.containerId}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => toggleContainer(c.containerId)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{c.name}</span>
                        <Badge variant="default">{c.publicId}</Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {c.usageContext?.join(', ') ?? 'web'}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{c.containerId}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* CTA */}
      {selectedCount > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">
            {selectedCount} container{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''} — prêt à déployer
          </span>
          <Button
            size="sm"
            onClick={() => window.location.assign('/dashboard/deploy')}
          >
            Aller au déploiement →
          </Button>
        </div>
      )}
    </div>
  );
}
