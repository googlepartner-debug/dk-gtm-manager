import { useGTMStore } from '../store/gtm-store';
import { Badge } from '../components/ui/Badge';

export function HistoryPage() {
  const { history } = useGTMStore();

  if (history.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Historique</h1>
        </div>
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <div className="text-slate-300 text-4xl mb-3">📋</div>
          <p className="text-sm text-slate-500">Aucun déploiement encore effectué.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Historique des déploiements</h1>
        <p className="text-sm text-slate-500 mt-1">{history.length} déploiement{history.length > 1 ? 's' : ''} enregistré{history.length > 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {history.map((record) => {
          const success = record.containers.filter((c) => c.status === 'success').length;
          const errors = record.containers.filter((c) => c.status === 'error').length;
          const total = record.containers.length;

          return (
            <details key={record.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden group">
              <summary className="px-4 py-3 flex items-center gap-3 cursor-pointer list-none hover:bg-slate-50 transition-colors">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="shrink-0 text-slate-400 group-open:rotate-90 transition-transform"
                >
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{record.packageName}</span>
                    {errors === 0 ? (
                      <Badge variant="success">{success}/{total} OK</Badge>
                    ) : success > 0 ? (
                      <Badge variant="warning">{success} OK · {errors} erreur{errors > 1 ? 's' : ''}</Badge>
                    ) : (
                      <Badge variant="error">Échec total</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(record.deployedAt).toLocaleString('fr-FR')} · Compte {record.accountId}
                  </div>
                </div>
              </summary>

              <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                <div className="space-y-2 mt-2">
                  {record.containers.map((c) => (
                    <div key={c.containerId} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'success' ? 'bg-emerald-500' : c.status === 'error' ? 'bg-red-500' : 'bg-slate-300'
                          }`}
                        />
                        <span className="text-slate-700">{c.containerName}</span>
                        <span className="text-slate-400">{c.containerPublicId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        {c.versionId && <span>v{c.versionId}</span>}
                        {c.error && <span className="text-red-500 max-w-[200px] truncate">{c.error.slice(0, 60)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
