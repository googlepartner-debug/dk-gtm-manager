import { useGTMStore } from '../store/gtm-store';
import { Badge } from '../components/ui/Badge';

export function HistoryPage() {
  const { history } = useGTMStore();

  if (history.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Historique</h1>
        </div>
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 5h16v2H3V5zm1.5 4h13v2h-13V9zm2 4h9v2h-9v-2z" fill="currentColor" className="text-muted-fg" opacity="0.7"/>
            </svg>
          </div>
          <p className="text-sm text-muted-fg">Aucun déploiement encore effectué.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Historique des déploiements</h1>
        <p className="text-sm text-muted-fg mt-1">{history.length} déploiement{history.length > 1 ? 's' : ''} enregistré{history.length > 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {history.map((record) => {
          const success = record.containers.filter((c) => c.status === 'success').length;
          const errors = record.containers.filter((c) => c.status === 'error').length;
          const total = record.containers.length;

          return (
            <details key={record.id} className="bg-card border border-border rounded-xl overflow-hidden group">
              <summary className="px-4 py-3 flex items-center gap-3 cursor-pointer list-none hover:bg-muted transition-colors">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="shrink-0 text-muted-fg group-open:rotate-90 transition-transform"
                >
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{record.packageName}</span>
                    {errors === 0 ? (
                      <Badge variant="success">{success}/{total} OK</Badge>
                    ) : success > 0 ? (
                      <Badge variant="warning">{success} OK · {errors} erreur{errors > 1 ? 's' : ''}</Badge>
                    ) : (
                      <Badge variant="error">Echec total</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-fg mt-0.5">
                    {new Date(record.deployedAt).toLocaleString('fr-FR')} · Compte {record.accountId}
                  </div>
                </div>
              </summary>

              <div className="px-4 pb-4 pt-1 border-t border-border">
                <div className="space-y-2 mt-2">
                  {record.containers.map((c) => (
                    <div key={c.containerId} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'success' ? 'bg-success' : c.status === 'error' ? 'bg-destructive' : 'bg-border'
                          }`}
                        />
                        <span className="text-foreground">{c.containerName}</span>
                        <span className="text-muted-fg">{c.containerPublicId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-fg">
                        {c.versionId && <span>v{c.versionId}</span>}
                        {c.error && <span className="text-destructive max-w-[200px] truncate">{c.error.slice(0, 60)}</span>}
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
