import { useState } from 'react';
import { clsx } from 'clsx';
import type { ContainerDiff, DiffEntity, EntityStatus } from '../../types/gtm';
import { Badge } from '../ui/Badge';
import { useGTMStore } from '../../store/gtm-store';

const STATUS_LABEL: Record<EntityStatus, string> = {
  new: 'Nouveau',
  modified: 'Modifié',
  unchanged: 'Inchangé',
};

const STATUS_BADGE: Record<EntityStatus, 'success' | 'warning' | 'default'> = {
  new: 'success',
  modified: 'warning',
  unchanged: 'default',
};

const KIND_LABEL = { tag: 'Tag', variable: 'Variable', trigger: 'Déclencheur' };
const KIND_COLOR = {
  tag: 'bg-purple-50 text-purple-700',
  variable: 'bg-blue-50 text-blue-700',
  trigger: 'bg-amber-50 text-amber-700',
};

function EntityRow({ entity, containerId }: { entity: DiffEntity; containerId: string }) {
  const { toggleEntitySelection } = useGTMStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={clsx('border-b border-slate-100 last:border-0', entity.status === 'unchanged' && 'opacity-50')}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
        onClick={() => toggleEntitySelection(containerId, entity.key)}
      >
        <input
          type="checkbox"
          checked={entity.selected}
          readOnly
          className="h-4 w-4 rounded border-slate-300 text-blue-600 pointer-events-none shrink-0"
        />
        <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium shrink-0', KIND_COLOR[entity.kind])}>
          {KIND_LABEL[entity.kind]}
        </span>
        <span className="text-sm text-slate-800 flex-1 truncate font-medium">{entity.name}</span>
        <Badge variant={STATUS_BADGE[entity.status]}>{STATUS_LABEL[entity.status]}</Badge>
        {entity.status === 'modified' && (
          <button
            className="text-xs text-slate-400 hover:text-slate-700 shrink-0 ml-1"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? 'Masquer diff' : 'Voir diff'}
          </button>
        )}
      </div>
      {expanded && entity.status === 'modified' && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-slate-400 mb-1">Actuel</div>
            <pre className="text-xs bg-red-50 border border-red-100 rounded p-2 overflow-auto max-h-32 text-red-800">
              {JSON.stringify(entity.current, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Nouveau</div>
            <pre className="text-xs bg-green-50 border border-green-100 rounded p-2 overflow-auto max-h-32 text-green-800">
              {JSON.stringify(entity.proposed, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ContainerDiffPanel({ diff }: { diff: ContainerDiff }) {
  const [expanded, setExpanded] = useState(false);
  const { selectAllEntities, deselectUnchanged } = useGTMStore();

  const newCount = diff.entities.filter((e) => e.status === 'new').length;
  const modCount = diff.entities.filter((e) => e.status === 'modified').length;
  const unchanged = diff.entities.filter((e) => e.status === 'unchanged').length;
  const selected = diff.entities.filter((e) => e.selected).length;

  if (diff.status === 'loading') {
    return (
      <div className="border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">{diff.containerName} — analyse en cours…</span>
      </div>
    );
  }

  if (diff.status === 'error') {
    return (
      <div className="border border-red-200 rounded-xl p-4 bg-red-50">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <span className="font-medium">{diff.containerName}</span>
          <Badge variant="error">Erreur</Badge>
        </div>
        <p className="text-xs text-red-500 mt-1">{diff.error}</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={clsx('shrink-0 text-slate-400 transition-transform', expanded && 'rotate-90')}
        >
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{diff.containerName}</span>
          <Badge variant="default">{diff.containerPublicId}</Badge>
          {newCount > 0 && <Badge variant="success">{newCount} nouveau{newCount > 1 ? 'x' : ''}</Badge>}
          {modCount > 0 && <Badge variant="warning">{modCount} modifié{modCount > 1 ? 's' : ''}</Badge>}
          {unchanged > 0 && <Badge variant="default">{unchanged} inchangé{unchanged > 1 ? 's' : ''}</Badge>}
        </div>
        <span className="text-xs text-blue-600 shrink-0">{selected} sélectionné{selected > 1 ? 's' : ''}</span>
      </div>

      {expanded && (
        <div className="border-t border-slate-100">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50">
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => selectAllEntities(diff.containerId)}
            >
              Tout sélectionner
            </button>
            <span className="text-slate-300">·</span>
            <button
              className="text-xs text-slate-500 hover:underline"
              onClick={() => deselectUnchanged(diff.containerId)}
            >
              Désélectionner inchangés
            </button>
          </div>
          {diff.entities.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucune entité dans ce package.</p>
          ) : (
            diff.entities.map((entity) => (
              <EntityRow key={entity.key} entity={entity} containerId={diff.containerId} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function DiffView({ diffs }: { diffs: Record<string, ContainerDiff> }) {
  const diffList = Object.values(diffs);
  if (diffList.length === 0) return null;

  return (
    <div className="space-y-2">
      {diffList.map((diff) => (
        <ContainerDiffPanel key={diff.containerId} diff={diff} />
      ))}
    </div>
  );
}
