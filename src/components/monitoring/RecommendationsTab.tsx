import { useMemo } from 'react';
import type { MonitoringContainerData } from '../../data/monitoring-mock';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Priority = 'critical' | 'warning' | 'info';
type Platform = 'Google Ads' | 'GA4' | 'Piano' | 'Matomo';

interface Recommendation {
  id: string;
  priority: Priority;
  platform: Platform;
  title: string;
  description: string;
  action: string;
  containers: string[];
  docHint?: string;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<Priority, { bg: string; border: string; color: string; dot: string; label: string }> = {
  critical: { bg: 'hsl(0 85% 97%)',   border: 'hsl(0 70% 85%)',   color: 'hsl(0 65% 40%)',   dot: 'hsl(0 70% 55%)',   label: 'Critique' },
  warning:  { bg: 'hsl(38 100% 97%)', border: 'hsl(38 95% 82%)',  color: 'hsl(35 90% 38%)',  dot: 'hsl(38 95% 52%)',  label: 'Attention' },
  info:     { bg: 'hsl(213 94% 97%)', border: 'hsl(213 94% 82%)', color: 'hsl(213 80% 38%)', dot: 'hsl(213 80% 55%)', label: 'Info' },
};

const PLATFORM_STYLE: Record<Platform, { color: string; bg: string }> = {
  'Google Ads': { color: 'hsl(27 96% 40%)',  bg: 'hsl(27 96% 95%)' },
  'GA4':        { color: 'hsl(213 80% 38%)', bg: 'hsl(213 94% 95%)' },
  'Piano':      { color: 'hsl(267 70% 40%)', bg: 'hsl(267 80% 96%)' },
  'Matomo':     { color: 'hsl(142 50% 28%)', bg: 'hsl(142 50% 95%)' },
};

// ─── Rule engine ───────────────────────────────────────────────────────────────

function isPageviewTrigger(c: MonitoringContainerData, triggerId: string): boolean {
  const trigger = c.triggers.find((t) => t.triggerId === triggerId);
  return trigger?.type === 'pageview';
}

function hasUserDataParam(params: import('../../types/gtm').GTMParameter[] | undefined): boolean {
  if (!params) return false;
  return params.some((p) =>
    p.key && (
      p.key.toLowerCase().includes('email') ||
      p.key.toLowerCase().includes('phone') ||
      p.key.toLowerCase().includes('userdata') ||
      p.key.toLowerCase().includes('enhanced')
    )
  );
}

function generateRecommendations(containers: MonitoringContainerData[]): Recommendation[] {
  const recs: Recommendation[] = [];

  // ── Google Ads: Conversion Linker absent ─────────────────────────────────────
  const noLinker = containers.filter((c) => !c.tags.some((t) => t.type === 'clmb'));
  if (noLinker.length > 0) {
    recs.push({
      id: 'gads-no-linker',
      priority: 'critical',
      platform: 'Google Ads',
      title: 'Conversion Linker absent',
      description: 'Sans Conversion Linker, les paramètres gclid ne sont pas persistés entre pages ni entre domaines. Toutes les conversions GA/Ads sont sous-comptées en navigation multi-onglets ou cookieless.',
      action: 'Ajouter le tag "Conversion Linker" (type clmb) avec le déclencheur All Pages, priorité élevée (avant les tags de conversion).',
      containers: noLinker.map((c) => c.containerName),
      docHint: 'Google recommande de placer le Conversion Linker avant tout autre tag Ads sur chaque page.',
    });
  }

  // ── Google Ads: Enhanced Conversions manquantes ───────────────────────────────
  const noEnhanced = containers.filter((c) => {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    return awcts.length > 0 && awcts.every((t) => !hasUserDataParam(t.parameter));
  });
  if (noEnhanced.length > 0) {
    recs.push({
      id: 'gads-no-enhanced',
      priority: 'critical',
      platform: 'Google Ads',
      title: 'Enhanced Conversions non configurées',
      description: 'Les Enhanced Conversions permettent de récupérer en moyenne +15% de conversions via correspondance de données first-party hashées (email, téléphone). Sans elles, les conversions sans cookie (Safari ITP, bloqueurs) sont perdues.',
      action: 'Dans le tag Conversion Tracking (awct), activer Enhanced Conversions et envoyer email/téléphone hashés SHA-256 via une variable Data Layer ou JavaScript.',
      containers: noEnhanced.map((c) => c.containerName),
      docHint: 'Données à hasher côté client ou via GTM : email (lowercase + trim avant SHA-256), phone au format E.164.',
    });
  }

  // ── Google Ads: Remarketing tag absent ───────────────────────────────────────
  const noRemarketing = containers.filter((c) => !c.tags.some((t) => t.type === 'awrk'));
  if (noRemarketing.length > 0) {
    recs.push({
      id: 'gads-no-remarketing',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'Tag Remarketing absent',
      description: 'Sans tag Remarketing Google Ads, les listes d\'audiences ne sont pas alimentées. Les campagnes de retargeting et le Smart Bidding basé sur les audiences sont dégradés.',
      action: 'Ajouter le tag "Google Ads Remarketing" (type awrk) sur All Pages. Pour le e-commerce, ajouter les paramètres Dynamic Remarketing : ecomm_prodid, ecomm_pagetype, ecomm_totalvalue.',
      containers: noRemarketing.map((c) => c.containerName),
    });
  }

  // ── Google Ads: Conversion tag sur All Pages ──────────────────────────────────
  const convOnAllPages: string[] = [];
  for (const c of containers) {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    for (const tag of awcts) {
      const firesOnPageview = (tag.firingTriggerId ?? []).some((id) => isPageviewTrigger(c, id));
      if (firesOnPageview) { convOnAllPages.push(c.containerName); break; }
    }
  }
  if (convOnAllPages.length > 0) {
    recs.push({
      id: 'gads-conv-on-pageview',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'Tag Conversion déclenché sur All Pages',
      description: 'Un tag Conversion Tracking est configuré sur un déclencheur de type pageview (All Pages ou equivalent). Cela provoque un double comptage de conversion à chaque visite.',
      action: 'Restreindre le firing du tag Conversion Tracking à un déclencheur événement spécifique (ex : DL - purchase, formulaire soumis).',
      containers: convOnAllPages,
    });
  }

  // ── Google Ads: conversionLabel manquant ──────────────────────────────────────
  const noLabel: string[] = [];
  for (const c of containers) {
    const awcts = c.tags.filter((t) => t.type === 'awct');
    const missing = awcts.filter((t) => !t.parameter?.find((p) => p.key === 'conversionLabel' && p.value));
    if (missing.length > 0) noLabel.push(c.containerName);
  }
  if (noLabel.length > 0) {
    recs.push({
      id: 'gads-no-label',
      priority: 'warning',
      platform: 'Google Ads',
      title: 'conversionLabel manquant sur le tag Conversion',
      description: 'Sans conversionLabel, la conversion remonte dans Google Ads sans pouvoir distinguer le type d\'action (achat, lead, inscription). Le reporting par action de conversion est impossible.',
      action: 'Renseigner le paramètre conversionLabel dans chaque tag awct. La valeur est disponible dans l\'interface Google Ads > Conversions.',
      containers: noLabel,
    });
  }

  // ── GA4: user_id absent sur les events e-commerce ────────────────────────────
  const noUserId: string[] = [];
  for (const c of containers) {
    const ecomEvents = c.tags.filter((t) => t.type === 'gaawe' && ['purchase', 'add_to_cart', 'begin_checkout'].includes(
      t.parameter?.find((p) => p.key === 'event_name')?.value ?? ''
    ));
    if (ecomEvents.length > 0 && ecomEvents.some((t) => !t.parameter?.find((p) => p.key === 'user_id'))) {
      noUserId.push(c.containerName);
    }
  }
  if (noUserId.length > 0) {
    recs.push({
      id: 'ga4-no-userid',
      priority: 'info',
      platform: 'GA4',
      title: 'user_id absent sur certains événements e-commerce',
      description: 'Le paramètre user_id manque sur au moins un événement clé (purchase, add_to_cart, begin_checkout). Sans user_id, les rapports "User" de GA4 sont basés uniquement sur client_id (cookie), dégradant la persistance cross-device.',
      action: 'Ajouter le paramètre user_id (valeur hashée ou opaque, jamais d\'identifiant direct) sur tous les événements e-commerce. Source recommandée : variable Data Layer user_id.',
      containers: noUserId,
    });
  }

  // ── GA4: Config tag sans send_page_view désactivé quand événement page_view manuel ──
  const doublePageview: string[] = [];
  for (const c of containers) {
    const hasManualPageView = c.tags.some((t) => t.type === 'gaawe' &&
      t.parameter?.find((p) => p.key === 'event_name')?.value === 'page_view'
    );
    if (hasManualPageView) {
      const configTag = c.tags.find((t) => t.type === 'gaawc');
      const sendPageView = configTag?.parameter?.find((p) => p.key === 'sendPageView')?.value;
      if (sendPageView !== 'false') doublePageview.push(c.containerName);
    }
  }
  if (doublePageview.length > 0) {
    recs.push({
      id: 'ga4-double-pageview',
      priority: 'warning',
      platform: 'GA4',
      title: 'Double page_view probable (Config + Event)',
      description: 'Un tag GA4 Event envoie un event page_view manuellement, mais le tag GA4 Config a send_page_view activé (comportement par défaut). Chaque visite génère deux événements page_view dans GA4.',
      action: 'Dans le tag GA4 Configuration (gaawc), désactiver "Envoyer un événement de page vue" (send_page_view: false) pour laisser le contrôle au tag Event.',
      containers: doublePageview,
    });
  }

  // ── Piano: tag présent mais sans siteId détectable ───────────────────────────
  const pianoNoId: string[] = [];
  for (const c of containers) {
    const pianoTags = c.tags.filter((t) => t.type === 'html' && (() => {
      const html = (t.parameter?.find((p) => p.key === 'html')?.value ?? '').toLowerCase();
      return html.includes('piano') || html.includes('at internet') || html.includes('smarttag') || html.includes('pa.setconfigurations');
    })());
    if (pianoTags.length > 0) {
      const hasId = pianoTags.some((t) => {
        const html = t.parameter?.find((p) => p.key === 'html')?.value ?? '';
        return /siteId\s*[:=]\s*['"]?(\d+)/i.test(html) || /site\s*[:=]\s*['"]?([^"',;\s]+)/i.test(html);
      });
      if (!hasId) pianoNoId.push(c.containerName);
    }
  }
  if (pianoNoId.length > 0) {
    recs.push({
      id: 'piano-no-siteid',
      priority: 'warning',
      platform: 'Piano',
      title: 'Piano Analytics : siteId non détecté',
      description: 'Un tag Piano Analytics est présent mais le siteId n\'a pas pu être détecté dans le code HTML. Sans siteId valide, les données ne sont pas envoyées à la bonne propriété Piano.',
      action: 'Vérifier que le siteId est correctement défini dans le tag HTML Piano (pa.setConfigurations({ site: XXXXXX })).',
      containers: pianoNoId,
    });
  }

  // ── Matomo: tag présent mais sans siteId détectable ──────────────────────────
  const matomoNoId: string[] = [];
  for (const c of containers) {
    const matomoTags = c.tags.filter((t) => t.type === 'html' && (() => {
      const html = (t.parameter?.find((p) => p.key === 'html')?.value ?? '').toLowerCase();
      return html.includes('matomo') || html.includes('_paq');
    })());
    if (matomoTags.length > 0) {
      const hasId = matomoTags.some((t) => {
        const html = t.parameter?.find((p) => p.key === 'html')?.value ?? '';
        return /setSiteId['"]\s*,\s*['"]?(\d+)/i.test(html);
      });
      if (!hasId) matomoNoId.push(c.containerName);
    }
  }
  if (matomoNoId.length > 0) {
    recs.push({
      id: 'matomo-no-siteid',
      priority: 'warning',
      platform: 'Matomo',
      title: 'Matomo : setSiteId non détecté',
      description: 'Un tag Matomo est présent mais setSiteId n\'a pas pu être extrait. Sans siteId, les données remontent dans le mauvais site Matomo ou pas du tout.',
      action: 'S\'assurer que _paq.push([\'setSiteId\', \'X\']) est présent avec le bon identifiant numérique de site.',
      containers: matomoNoId,
    });
  }

  return recs;
}

// ─── Count helper (exported for MonitoringPage badge) ─────────────────────────

export function countCriticalRecommendations(containers: MonitoringContainerData[]): number {
  return generateRecommendations(containers).filter((r) => r.priority === 'critical').length;
}

// ─── Card component ────────────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const ps = PRIORITY_STYLE[rec.priority];
  const plt = PLATFORM_STYLE[rec.platform];

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: ps.bg, borderColor: ps.border }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ps.dot }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ backgroundColor: plt.bg, color: plt.color }}
            >
              {rec.platform}
            </span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ backgroundColor: ps.border + '55', color: ps.color }}
            >
              {ps.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug" style={{ color: ps.color }}>{rec.title}</h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed pl-5" style={{ color: 'hsl(220 13% 30%)' }}>
        {rec.description}
      </p>

      {/* Action */}
      <div className="pl-5 flex items-start gap-2">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5" style={{ color: ps.color }}>
          <path d="M6 1v7M3 5.5L6 8l3-2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 11h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        <p className="text-xs font-medium leading-relaxed" style={{ color: 'hsl(220 13% 20%)' }}>
          {rec.action}
        </p>
      </div>

      {/* Doc hint */}
      {rec.docHint && (
        <div
          className="pl-5 text-[11px] leading-relaxed italic"
          style={{ color: 'hsl(220 13% 50%)' }}
        >
          {rec.docHint}
        </div>
      )}

      {/* Affected containers */}
      <div className="pl-5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-fg">Containers :</span>
        {rec.containers.map((name) => (
          <span
            key={name}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'hsl(220 13% 91%)', color: 'hsl(220 13% 35%)' }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RecommendationsTab({ containers }: { containers: MonitoringContainerData[] }) {
  const recs = useMemo(() => generateRecommendations(containers), [containers]);

  const critical = recs.filter((r) => r.priority === 'critical');
  const warnings = recs.filter((r) => r.priority === 'warning');
  const infos    = recs.filter((r) => r.priority === 'info');

  if (recs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-fg">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
          <path d="M11 18l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".6"/>
        </svg>
        <p className="text-sm font-medium">Aucune recommandation — configuration optimale</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div
        className="px-6 py-3 border-b shrink-0 flex items-center gap-4"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)' }}
      >
        {critical.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'hsl(0 65% 40%)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(0 70% 55%)' }} />
            {critical.length} critique{critical.length > 1 ? 's' : ''}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'hsl(35 90% 38%)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(38 95% 52%)' }} />
            {warnings.length} attention{warnings.length > 1 ? 's' : ''}
          </div>
        )}
        {infos.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'hsl(213 80% 38%)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(213 80% 55%)' }} />
            {infos.length} info{infos.length > 1 ? 's' : ''}
          </div>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-fg">Basé sur les données scannées · règles Google Ads, GA4, Piano, Matomo</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
        {critical.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(0 65% 50%)' }}>
              Critique — action immédiate
            </h2>
            {critical.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </section>
        )}
        {warnings.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(35 90% 45%)' }}>
              Attention — à corriger prochainement
            </h2>
            {warnings.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </section>
        )}
        {infos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(213 80% 45%)' }}>
              Info — optimisations possibles
            </h2>
            {infos.map((r) => <RecommendationCard key={r.id} rec={r} />)}
          </section>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-2 shrink-0 text-xs"
        style={{ borderColor: 'hsl(220 13% 91%)', backgroundColor: 'hsl(220 20% 98%)', color: 'hsl(220 13% 50%)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
          <path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        Analyse statique · ne remplace pas un audit manuel · données simulées en mode aperçu
      </div>
    </div>
  );
}
