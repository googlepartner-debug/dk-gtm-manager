import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { useGTMStore } from '../store/gtm-store';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DiffView } from '../components/diff/DiffView';
import type { DeploymentResult } from '../types/gtm';

type Step = 'select' | 'diff' | 'progress' | 'done';

function StepIcon({ status }: { status: DeploymentResult['steps'][0]['status'] }) {
  if (status === 'success') return (
    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
  if (status === 'error') return (
    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 3l4 4M7 3l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
  if (status === 'running') return (
    <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
  );
  return <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />;
}

export function DeployPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const {
    packages, selectedPackageId, selectPackage,
    containers, selectedContainerIds,
    diffs, isDiffing, computeDiffs, globalDiffSummary, resetDiffs,
    isDeploying, deploymentResults, deploymentProgress,
    autoPublish, setAutoPublish,
    deploy, resetDeployment,
  } = useGTMStore();

  const [step, setStep] = useState<Step>('select');
  const [versionName, setVersionName] = useState(`DK Deploy ${new Date().toLocaleDateString('fr-FR')}`);

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const selectedContainers = containers.filter((c) => selectedContainerIds.has(c.containerId));
  const canAnalyse = !!selectedPkg && selectedContainers.length > 0;
  const summary = globalDiffSummary();
  const hasDiff = Object.values(diffs).some((d) => d.status === 'ready');
  const canDeploy = hasDiff && summary.selectedCount > 0 && !isDeploying;

  const handleAnalyse = async () => {
    if (!accessToken) return;
    resetDiffs();
    setStep('diff');
    await computeDiffs(accessToken);
  };

  const handleDeploy = async () => {
    if (!accessToken || !selectedPackageId) return;
    setStep('progress');
    await deploy(accessToken, selectedPackageId, versionName);
    setStep('done');
  };

  const handleReset = () => {
    resetDeployment();
    resetDiffs();
    setStep('select');
  };

  const successCount = deploymentResults.filter((r) => r.status === 'success').length;
  const errorCount = deploymentResults.filter((r) => r.status === 'error').length;

  // ─── Progress / Done ────────────────────────────────────────────────────────

  if (step === 'progress' || step === 'done') {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            {step === 'done' ? 'Déploiement terminé' : 'Déploiement en cours…'}
          </h1>
          {step === 'done' && (
            <div className="flex items-center gap-3 mt-2">
              {successCount > 0 && <Badge variant="success">{successCount} succès</Badge>}
              {errorCount > 0 && <Badge variant="error">{errorCount} erreur{errorCount > 1 ? 's' : ''}</Badge>}
            </div>
          )}
        </div>

        {step === 'progress' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Progression</span><span>{deploymentProgress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${deploymentProgress}%` }} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {deploymentResults.map((result) => (
            <div key={result.containerId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-900">{result.containerName}</span>
                  <Badge variant="default">{result.containerPublicId}</Badge>
                </div>
                {result.status === 'success' && <Badge variant="success">{autoPublish ? 'Publié' : 'Version créée'}</Badge>}
                {result.status === 'error' && <Badge variant="error">Erreur</Badge>}
                {result.status === 'running' && <Badge variant="info">En cours…</Badge>}
                {result.status === 'pending' && <Badge variant="default">En attente</Badge>}
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {result.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <StepIcon status={s.status} />
                    <span className={`text-xs ${s.status === 'pending' ? 'text-slate-400' : 'text-slate-700'}`}>{s.label}</span>
                    {s.detail && (
                      <span className={`text-xs font-mono ${s.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                        {s.status === 'error' ? s.detail.slice(0, 80) : s.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {step === 'done' && (
          <div className="mt-6 flex gap-3">
            <Button onClick={handleReset}>Nouveau déploiement</Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard/history')}>Voir l'historique</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Diff step ──────────────────────────────────────────────────────────────

  if (step === 'diff') {
    return (
      <div className="max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <button
            className="text-slate-500 hover:text-slate-900"
            onClick={() => { setStep('select'); resetDiffs(); }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Analyse des containers</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Sélectionnez les entités à déployer, puis confirmez.
            </p>
          </div>
        </div>

        {/* Global summary */}
        {hasDiff && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{summary.newCount}</div>
              <div className="text-xs text-slate-500">nouveau{summary.newCount > 1 ? 'x' : ''}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{summary.modifiedCount}</div>
              <div className="text-xs text-slate-500">modifié{summary.modifiedCount > 1 ? 's' : ''}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">{summary.unchangedCount}</div>
              <div className="text-xs text-slate-500">inchangé{summary.unchangedCount > 1 ? 's' : ''}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm font-medium text-blue-700">{summary.selectedCount} sélectionné{summary.selectedCount > 1 ? 's' : ''}</div>
              <div className="text-xs text-slate-400">sur {selectedContainers.length} container{selectedContainers.length > 1 ? 's' : ''}</div>
            </div>
          </div>
        )}

        {/* Container diffs */}
        <DiffView diffs={diffs} />

        {/* Version + publish options */}
        {hasDiff && (
          <div className="mt-4 space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Nom de la version GTM
                </label>
                <input
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPublish}
                    onChange={(e) => setAutoPublish(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Publier automatiquement après déploiement</span>
                </label>
                {!autoPublish && (
                  <span className="text-xs text-slate-400">La version sera créée mais pas publiée</span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                <path d="M7 1L13 12H1L7 1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                <path d="M7 5v3M7 10h.01" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              <span>
                {summary.selectedCount} entité{summary.selectedCount > 1 ? 's' : ''} seront déployées sur{' '}
                <strong>{selectedContainers.length} container{selectedContainers.length > 1 ? 's' : ''}</strong>
                {autoPublish ? ' et publiées immédiatement.' : ' (version créée, pas encore publiée).'}
              </span>
            </div>

            <Button size="lg" className="w-full" disabled={!canDeploy} onClick={handleDeploy} loading={isDeploying}>
              {`Déployer ${summary.selectedCount} entité${summary.selectedCount > 1 ? 's' : ''} sur ${selectedContainers.length} container${selectedContainers.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        )}

        {isDiffing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Analyse en cours sur {selectedContainers.length} container{selectedContainers.length > 1 ? 's' : ''}…
          </div>
        )}
      </div>
    );
  }

  // ─── Select step ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Déployer un package</h1>
        <p className="text-sm text-slate-500 mt-1">Sélectionnez le package et les containers, puis analysez le diff.</p>
      </div>

      <div className="space-y-4">
        {/* Package */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Package à déployer
          </label>
          {packages.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">
              Aucun package.{' '}
              <button className="text-blue-600 hover:underline" onClick={() => navigate('/dashboard/packages')}>
                Créer un package
              </button>
            </p>
          ) : (
            <select
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedPackageId ?? ''}
              onChange={(e) => selectPackage(e.target.value || null)}
            >
              <option value="">— Choisir un package —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.entities.tags.length}T · {p.entities.variables.length}V · {p.entities.triggers.length}D)
                </option>
              ))}
            </select>
          )}
          {selectedPkg && (
            <div className="mt-3 flex gap-4 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <span><strong className="text-slate-700">{selectedPkg.entities.tags.length}</strong> tags</span>
              <span><strong className="text-slate-700">{selectedPkg.entities.variables.length}</strong> variables</span>
              <span><strong className="text-slate-700">{selectedPkg.entities.triggers.length}</strong> déclencheurs</span>
            </div>
          )}
        </div>

        {/* Containers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Containers cibles
            </label>
            <button className="text-xs text-blue-600 hover:underline" onClick={() => navigate('/dashboard/containers')}>
              Gérer →
            </button>
          </div>
          {selectedContainers.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">
              Aucun container sélectionné.{' '}
              <button className="text-blue-600 hover:underline" onClick={() => navigate('/dashboard/containers')}>
                Sélectionner
              </button>
            </p>
          ) : (
            <div className="space-y-1.5">
              {selectedContainers.map((c) => (
                <div key={c.containerId} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-slate-700">{c.name}</span>
                  <Badge variant="default">{c.publicId}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!canAnalyse}
          loading={isDiffing}
          onClick={handleAnalyse}
        >
          {canAnalyse
            ? `Analyser ${selectedContainers.length} container${selectedContainers.length > 1 ? 's' : ''} →`
            : 'Sélectionnez un package et des containers'}
        </Button>
      </div>
    </div>
  );
}
