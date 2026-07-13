import { useState, useMemo } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import { MONITORING_MOCK } from '../data/monitoring-mock';

interface MockVersion {
  id: string;
  name: string;
  description: string;
  date: string;
  tags: string[];
  author: string;
}

const MOCK_VERSIONS: MockVersion[] = [
  { id: 'v12', name: 'DK Deploy — Consent Mode v2', description: 'Activation Consent Mode Advanced + OneTrust', date: '2024-11-15', tags: ['Consent Mode', 'OneTrust'], author: 'Ron K.' },
  { id: 'v11', name: 'GA4 Config + Enhanced Conversions', description: 'Ajout Enhanced Conversions Google Ads, hashed email/phone', date: '2024-09-03', tags: ['GA4', 'Google Ads'], author: 'Ron K.' },
  { id: 'v10', name: 'Migration GA4 — événements ecommerce', description: 'purchase, add_to_cart, view_item, begin_checkout', date: '2024-06-20', tags: ['GA4'], author: 'Ron K.' },
  { id: 'v9', name: 'Piano Analytics — Corsair', description: 'Implémentation Piano Analytics siteId 647382', date: '2024-04-10', tags: ['Piano'], author: 'Ron K.' },
  { id: 'v8', name: 'Google Ads — Remarketing', description: 'Ajout tag remarketing awrk sur tous containers', date: '2024-02-28', tags: ['Google Ads'], author: 'Ron K.' },
  { id: 'v7', name: 'Floodlight — Iberia', description: 'Tags Floodlight activité et vente Iberia', date: '2023-11-05', tags: ['Floodlight'], author: 'Ron K.' },
  { id: 'v6', name: 'Multi-property GA4 via LT', description: 'Lookup Table GA4 Measurement ID (fr/int/de)', date: '2023-08-18', tags: ['GA4'], author: 'Ron K.' },
  { id: 'v5', name: 'Conversion Linker — tous containers', description: 'Déploiement Conversion Linker obligatoire', date: '2023-05-12', tags: ['Google Ads'], author: 'Ron K.' },
  { id: 'v4', name: 'Google Ads — Conversions', description: 'Tags conversion achat + microconversion', date: '2023-03-01', tags: ['Google Ads'], author: 'Ron K.' },
  { id: 'v3', name: 'Migration UA → GA4', description: 'Remplacement Universal Analytics par GA4 Config', date: '2022-12-14', tags: ['GA4'], author: 'Ron K.' },
  { id: 'v2', name: 'Initialisation GTM', description: 'Setup initial — tags de base', date: '2022-06-01', tags: [], author: 'Ron K.' },
  { id: 'v1', name: 'Workspace initial', description: 'Création du container GTM', date: '2022-01-10', tags: [], author: 'Ron K.' },
];

type TabType = 'analyse' | 'timeline';

interface TagCategoryCount {
  category: string;
  count: number;
  type: string;
}

interface VariableTypeCount {
  type: string;
  count: number;
}

interface TriggerTypeCount {
  type: string;
  count: number;
}

function ContextePage() {
  const [activeTab, setActiveTab] = useState<TabType>('analyse');
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

  // Get data for selected container(s)
  const containerData = useMemo(() => {
    if (selectedContainer === 'all') {
      return MONITORING_MOCK;
    }
    return MONITORING_MOCK.filter((c) => c.containerId === selectedContainer);
  }, [selectedContainer]);

  // Aggregate tags by category
  const tagsByCategory = useMemo<TagCategoryCount[]>(() => {
    const categoryMap = new Map<string, number>();
    containerData.forEach((container) => {
      container.tags.forEach((tag) => {
        const existing = categoryMap.get(tag.type) || 0;
        categoryMap.set(tag.type, existing + 1);
      });
    });

    const typeLabels: Record<string, string> = {
      gaawc: 'GA4 Config',
      gaawe: 'GA4 Event',
      awct: 'Google Ads Conversion',
      awrk: 'Google Ads Remarketing',
      flc: 'Floodlight',
      html: 'HTML Custom',
      gtag: 'Global gtag',
      img: 'Image Pixel',
    };

    return Array.from(categoryMap.entries())
      .map(([type, count]) => ({
        category: typeLabels[type] || type,
        count,
        type,
      }))
      .sort((a, b) => b.count - a.count);
  }, [containerData]);

  // Count variables by type
  const variablesByType = useMemo<VariableTypeCount[]>(() => {
    const typeMap = new Map<string, number>();
    containerData.forEach((container) => {
      container.variables.forEach((variable) => {
        const existing = typeMap.get(variable.type) || 0;
        typeMap.set(variable.type, existing + 1);
      });
    });

    const typeLabels: Record<string, string> = {
      v: 'Data Layer Variable',
      c: 'Constant',
      u: 'URL Variable',
      k: 'Cookie',
      e: 'Environment Name',
      jsm: 'Custom JavaScript',
      smm: 'Lookup Table',
      gtm: 'GTM Variable',
    };

    return Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type: typeLabels[type] || type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [containerData]);

  // Count triggers by type
  const triggersByType = useMemo<TriggerTypeCount[]>(() => {
    const typeMap = new Map<string, number>();
    containerData.forEach((container) => {
      container.triggers.forEach((trigger) => {
        const existing = typeMap.get(trigger.type) || 0;
        typeMap.set(trigger.type, existing + 1);
      });
    });

    const typeLabels: Record<string, string> = {
      pageview: 'Page View',
      domReady: 'DOM Ready',
      windowLoaded: 'Window Loaded',
      customEvent: 'Custom Event',
      click: 'Click',
      linkClick: 'Link Click',
      formSubmit: 'Form Submit',
      scrollDepth: 'Scroll Depth',
      timer: 'Timer',
      youTubeVideo: 'YouTube Video',
      videoProgress: 'Video Progress',
    };

    return Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type: typeLabels[type] || type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [containerData]);

  // Extract unique GA4 event_name values from gaawe tags
  const ga4Events = useMemo<string[]>(() => {
    const events = new Set<string>();
    containerData.forEach((container) => {
      container.tags.forEach((tag) => {
        if (tag.type === 'gaawe') {
          const eventParam = tag.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName');
          if (eventParam?.value) {
            events.add(eventParam.value);
          }
        }
      });
    });
    return Array.from(events).sort();
  }, [containerData]);

  // Detect Universal Analytics traces
  const uaTraces = useMemo(() => {
    const UA_ID_RE = /UA-\d{4,12}-\d{1,4}/i;
    const ANALYTICS_JS_RE = /analytics\.js|google-analytics\.com\/analytics/i;
    const GA_COOKIE_RE = /^_ga$|^_gid$|^_gac_/i;

    const traces: { kind: 'tag' | 'variable'; name: string; container: string; reason: string }[] = [];

    containerData.forEach((container) => {
      // Tags UA (type `ua`) or params containing UA-XXXXX tracking ID
      container.tags.forEach((tag) => {
        if (tag.type === 'ua') {
          const trackingId = tag.parameter?.find((p) => p.key === 'trackingId')?.value ?? '';
          traces.push({ kind: 'tag', name: tag.name, container: container.containerName, reason: `Tag type UA${trackingId ? ` (${trackingId})` : ''}` });
          return;
        }
        // HTML custom tags embedding analytics.js or UA tracking ID
        const html = tag.parameter?.find((p) => p.key === 'html')?.value ?? '';
        if (ANALYTICS_JS_RE.test(html)) {
          traces.push({ kind: 'tag', name: tag.name, container: container.containerName, reason: 'Contient analytics.js ou google-analytics.com' });
          return;
        }
        const uaMatch = tag.parameter?.some((p) => p.value && UA_ID_RE.test(p.value));
        if (uaMatch) {
          traces.push({ kind: 'tag', name: tag.name, container: container.containerName, reason: 'Paramètre avec ID Universal Analytics (UA-XXXXX)' });
        }
      });

      // Variables: cookie _ga/_gid/_gac_*, or JS custom referencing _ga cookie / UA ID
      container.variables.forEach((variable) => {
        if (variable.type === 'k') {
          const cookieName = variable.parameter?.find((p) => p.key === 'cookieName')?.value ?? '';
          if (GA_COOKIE_RE.test(cookieName)) {
            traces.push({ kind: 'variable', name: variable.name, container: container.containerName, reason: `Cookie UA : ${cookieName}` });
            return;
          }
        }
        if (variable.type === 'jsm') {
          const code = variable.parameter?.find((p) => p.key === 'javascript')?.value ?? '';
          if (/_ga|_gid|_gac_|analytics\.js|UA-\d/i.test(code)) {
            traces.push({ kind: 'variable', name: variable.name, container: container.containerName, reason: 'Code JS référençant cookies UA ou analytics.js' });
          }
        }
        const uaInName = /universal.analytics|UA-\d/i.test(variable.name);
        if (uaInName) {
          traces.push({ kind: 'variable', name: variable.name, container: container.containerName, reason: 'Nom de variable référençant Universal Analytics' });
        }
      });
    });

    return traces;
  }, [containerData]);

  // Detect Consent Mode, Lookup Table GA4, Enhanced Conversions
  const signals = useMemo(() => {
    let consentModeDetected = false;
    let lookupTableGA4Detected = false;
    let enhancedConversionsDetected = false;

    containerData.forEach((container) => {
      // Consent Mode: look for 'consent' in tag/variable names or params
      container.tags.forEach((tag) => {
        if (tag.name.toLowerCase().includes('consent')) {
          consentModeDetected = true;
        }
        tag.parameter?.forEach((p) => {
          if (p.value?.toLowerCase().includes('consent')) {
            consentModeDetected = true;
          }
        });
      });

      // Enhanced Conversions: look for params with 'email', 'phone', 'userdata' in awct tags
      container.tags.forEach((tag) => {
        if (tag.type === 'awct' || tag.name.toLowerCase().includes('enhanced')) {
          tag.parameter?.forEach((p) => {
            const lowerValue = p.value?.toLowerCase() || '';
            if (lowerValue.includes('email') || lowerValue.includes('phone') || lowerValue.includes('userdata')) {
              enhancedConversionsDetected = true;
            }
          });
        }
      });

      // Lookup Table GA4: look for smm (LookupTable) variable type with GA4 context
      container.variables.forEach((variable) => {
        if (variable.type === 'smm' && (variable.name.toLowerCase().includes('ga4') || variable.name.toLowerCase().includes('measurement'))) {
          lookupTableGA4Detected = true;
        }
      });
    });

    return {
      consentMode: consentModeDetected,
      lookupTableGA4: lookupTableGA4Detected,
      enhancedConversions: enhancedConversionsDetected,
    };
  }, [containerData]);

  const versionTagBadgeVariant = (tag: string): 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline' => {
    if (tag === 'GA4') return 'success';
    if (tag === 'Google Ads') return 'info';
    if (tag === 'Consent Mode') return 'warning';
    if (tag === 'Floodlight') return 'error';
    if (tag === 'Piano') return 'warning';
    if (tag === 'OneTrust') return 'default';
    return 'outline';
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Contexte GTM</h1>
          <InfoTooltip>Vue d'ensemble d'un container : composition (nombre de tags/variables/déclencheurs par catégorie) et timeline des versions publiées, pour comprendre l'historique avant d'intervenir.</InfoTooltip>
        </div>
        <p className="text-muted-fg">Analyse des containers et historique des versions</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <Button
          variant={activeTab === 'analyse' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('analyse')}
          className="border-b-2 rounded-none h-10 px-4"
          style={activeTab === 'analyse' ? { borderBottomColor: 'hsl(267 100% 59%)' } : {}}
        >
          Analyse container
        </Button>
        <Button
          variant={activeTab === 'timeline' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('timeline')}
          className="border-b-2 rounded-none h-10 px-4"
          style={activeTab === 'timeline' ? { borderBottomColor: 'hsl(267 100% 59%)' } : {}}
        >
          Timeline des versions
        </Button>
      </div>

      <div className="flex-1">
        {activeTab === 'analyse' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">Sélectionner container</label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedContainer === 'all' || selectedContainer === null ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedContainer('all')}
                >
                  Tous les containers
                </Button>
                {MONITORING_MOCK.map((container) => (
                  <Button
                    key={container.containerId}
                    variant={selectedContainer === container.containerId ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSelectedContainer(container.containerId)}
                  >
                    {container.containerName}
                  </Button>
                ))}
              </div>
            </div>

            {selectedContainer === null && (
              <div className="bg-muted border border-border rounded-lg p-4">
                <p className="text-muted-fg text-sm">Sélectionnez un container pour afficher l'analyse</p>
              </div>
            )}

            {selectedContainer !== null && containerData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Tags par catégorie</h3>
                  <div className="flex flex-col gap-3">
                    {tagsByCategory.map((item) => (
                      <div key={item.type} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-fg">{item.category}</span>
                          <span className="text-sm font-semibold text-foreground">{item.count}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${Math.max((item.count / Math.max(...tagsByCategory.map((c) => c.count), 1)) * 100, 5)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Variables par type</h3>
                  <div className="flex flex-col gap-3">
                    {variablesByType.map((item) => (
                      <div key={item.type} className="flex justify-between items-center">
                        <span className="text-sm text-muted-fg">{item.type}</span>
                        <span className="text-sm font-semibold text-foreground">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Triggers par type</h3>
                  <div className="flex flex-col gap-3">
                    {triggersByType.map((item) => (
                      <div key={item.type} className="flex justify-between items-center">
                        <span className="text-sm text-muted-fg">{item.type}</span>
                        <span className="text-sm font-semibold text-foreground">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">DataLayer events</h3>
                  <div className="flex flex-wrap gap-2">
                    {ga4Events.length > 0 ? (
                      ga4Events.map((event) => (
                        <Badge key={event} variant="info">
                          {event}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-fg">Aucun événement GA4 détecté</p>
                    )}
                  </div>
                </div>

                {/* Universal Analytics traces */}
                <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Traces Universal Analytics</h3>
                    {uaTraces.length === 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'hsl(142 76% 36% / 0.12)', color: 'hsl(142 76% 36%)' }}>Aucune trace</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'hsl(38 92% 50% / 0.12)', color: 'hsl(32 95% 44%)' }}>{uaTraces.length} trace{uaTraces.length > 1 ? 's' : ''} détectée{uaTraces.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {uaTraces.length === 0 ? (
                    <p className="text-sm text-muted-fg">Aucun tag UA, cookie _ga/_gid, ni analytics.js détecté dans ce container.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {uaTraces.map((trace, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: 'hsl(38 92% 50% / 0.06)', border: '1px solid hsl(38 92% 50% / 0.2)' }}>
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                            style={{ backgroundColor: trace.kind === 'tag' ? 'hsl(267 100% 59% / 0.15)' : 'hsl(214 100% 50% / 0.12)', color: trace.kind === 'tag' ? 'hsl(267 100% 59%)' : 'hsl(214 100% 50%)' }}>
                            {trace.kind === 'tag' ? 'Tag' : 'Var'}
                          </span>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">{trace.name}</span>
                            <span className="text-xs text-muted-fg">{trace.container} · {trace.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Signaux détectés</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: signals.consentMode ? 'hsl(142 76% 36%)' : 'hsl(214 32% 91%)' }}
                      />
                      <span className="text-sm text-muted-fg">Consent Mode</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: signals.lookupTableGA4 ? 'hsl(142 76% 36%)' : 'hsl(214 32% 91%)' }}
                      />
                      <span className="text-sm text-muted-fg">Lookup Table GA4</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: signals.enhancedConversions ? 'hsl(142 76% 36%)' : 'hsl(214 32% 91%)' }}
                      />
                      <span className="text-sm text-muted-fg">Enhanced Conversions</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-4">
            <div className="relative pl-8">
              <div className="absolute left-3 top-0 bottom-0 w-1 bg-primary/20" />

              {MOCK_VERSIONS.map((version) => (
                <div key={version.id} className="relative pb-8 flex">
                  <div className="absolute top-2 w-2 h-2 rounded-full bg-primary border-2 border-card" style={{ left: '-17px' }} />
                  <div className="flex-1 bg-card border border-border rounded-lg p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 flex flex-col gap-1">
                          <h4 className="font-semibold text-foreground">{version.name}</h4>
                          <p className="text-xs text-muted-fg">{version.date}</p>
                        </div>
                        <span className="text-xs text-muted-fg whitespace-nowrap">{version.author}</span>
                      </div>
                      <p className="text-sm text-muted-fg">{version.description}</p>
                      {version.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {version.tags.map((tag) => (
                            <Badge key={tag} variant={versionTagBadgeVariant(tag)}>
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { ContextePage };
