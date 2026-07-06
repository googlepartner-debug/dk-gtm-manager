import { useMemo, useState } from 'react';
import type { MonitoringContainerData } from '../../data/monitoring-mock';
import type { GTMVariable } from '../../types/gtm';
import { TagTypeIcon } from './TagTypeIcon';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'GA4' | 'Piano' | 'Matomo' | 'Google Ads' | 'Floodlight' | 'Kameleoon' | 'AB Tasty' | 'Meta Pixel' | 'TikTok' | 'Hotjar' | 'Criteo' | 'Custom';

interface Destination {
  id: string;
  measurementId: string;
  isVariable: boolean;
  variableName?: string;
  variableType?: string;
  fromLT?: boolean;
  ltVariableName?: string;
}

interface ConfigNode {
  id: string;
  tagName: string;
  tagType: string;
  platform: Platform;
  destinations: Destination[];
  eventCount: number;
  isMultiProperty?: boolean;
}

interface ContainerFlow {
  containerId: string;
  containerName: string;
  publicId: string;
  configs: ConfigNode[];
}

// ─── Platform style ────────────────────────────────────────────────────────────

const PLATFORM_STYLE: Record<Platform, { bg: string; border: string; color: string; accent: string }> = {
  'GA4':        { bg: 'hsl(213 94% 97%)', border: 'hsl(213 94% 78%)', color: 'hsl(213 94% 35%)', accent: 'hsl(213 94% 60%)' },
  'Piano':      { bg: 'hsl(267 80% 97%)', border: 'hsl(267 80% 78%)', color: 'hsl(267 80% 40%)', accent: 'hsl(267 80% 55%)' },
  'Matomo':     { bg: 'hsl(142 50% 96%)', border: 'hsl(142 50% 72%)', color: 'hsl(142 50% 28%)', accent: 'hsl(142 50% 45%)' },
  'Google Ads': { bg: 'hsl(27 96% 97%)', border: 'hsl(27 96% 75%)', color: 'hsl(27 96% 35%)', accent: 'hsl(27 96% 55%)' },
  'Floodlight': { bg: 'hsl(36 100% 96%)', border: 'hsl(36 100% 72%)', color: 'hsl(36 100% 30%)', accent: 'hsl(36 100% 48%)' },
  'Kameleoon':  { bg: 'hsl(267 50% 97%)', border: 'hsl(267 50% 78%)', color: 'hsl(267 50% 35%)', accent: 'hsl(267 50% 55%)' },
  'AB Tasty':   { bg: 'hsl(340 80% 97%)', border: 'hsl(340 80% 78%)', color: 'hsl(340 80% 38%)', accent: 'hsl(340 80% 55%)' },
  'Meta Pixel': { bg: 'hsl(221 80% 97%)', border: 'hsl(221 80% 78%)', color: 'hsl(221 80% 38%)', accent: 'hsl(221 80% 55%)' },
  'TikTok':     { bg: 'hsl(180 50% 96%)', border: 'hsl(180 50% 72%)', color: 'hsl(180 60% 25%)', accent: 'hsl(180 60% 40%)' },
  'Hotjar':     { bg: 'hsl(17 90% 97%)', border: 'hsl(17 90% 75%)', color: 'hsl(17 90% 35%)', accent: 'hsl(17 90% 55%)' },
  'Criteo':     { bg: 'hsl(28 90% 97%)', border: 'hsl(28 90% 75%)', color: 'hsl(28 90% 35%)', accent: 'hsl(28 90% 52%)' },
  'Custom':     { bg: 'hsl(220 13% 96%)', border: 'hsl(220 13% 78%)', color: 'hsl(220 13% 38%)', accent: 'hsl(220 13% 55%)' },
};

const PLATFORM_ICON_CAT: Record<Platform, string> = {
  'GA4': 'GA4', 'Piano': 'Piano', 'Matomo': 'Matomo',
  'Google Ads': 'Google Ads', 'Floodlight': 'Floodlight',
  'Kameleoon': 'Kameleoon', 'AB Tasty': 'AB Tasty', 'Meta Pixel': 'Meta Pixel',
  'TikTok': 'TikTok', 'Hotjar': 'Hotjar', 'Criteo': 'Criteo', 'Custom': 'HTML Custom',
};

// ─── Detection helpers ─────────────────────────────────────────────────────────

function isVarRef(v: string) { return /^\{\{.+\}\}$/.test(v.trim()); }
function varName(v: string) { return v.trim().replace(/^\{\{|\}\}$/g, ''); }

function resolveLTValues(variable: GTMVariable): string[] {
  const mapParam = variable.parameter?.find((p) => p.key === 'map' && p.type === 'list');
  if (!mapParam?.list) return [];
  return mapParam.list
    .map((item) => item.map?.find((m) => m.key === 'value')?.value)
    .filter((v): v is string => !!v);
}

function detectHtmlPlatform(tagName: string, html: string): { platform: Platform; destId: string } {
  const lc = (tagName + html).toLowerCase();
  if (lc.includes('piano') || lc.includes('at internet') || lc.includes('smarttag')) {
    const m = html.match(/setSiteId['"]\s*,\s*['"]?(\d+)/i) ||
              html.match(/siteId\s*[:=]\s*['"]?(\d+)/i) ||
              html.match(/(?:site|sfCode)\s*[=:]\s*["']?([^"',;\s]+)/i);
    return { platform: 'Piano', destId: m?.[1] ?? '' };
  }
  if (lc.includes('matomo') || lc.includes('_paq')) {
    const m = html.match(/setSiteId['"]\s*,\s*['"]?(\d+)/i) ||
              html.match(/siteId\s*[:=]\s*['"]?(\d+)/i);
    return { platform: 'Matomo', destId: m?.[1] ?? '' };
  }
  if (lc.includes('kameleoon')) {
    const m = html.match(/siteCode[:\s"'=]+([a-z0-9_-]{4,})/i) ||
              html.match(/kameleoon[^/]*\/([a-z0-9_-]+)\.js/i);
    return { platform: 'Kameleoon', destId: m?.[1] ?? '' };
  }
  if (lc.includes('abtasty') || lc.includes('ab tasty') || lc.includes('abtastyjs')) {
    const m = html.match(/abtasty\.com\/users\/([a-z0-9]+)\.js/i);
    return { platform: 'AB Tasty', destId: m?.[1] ?? '' };
  }
  if (lc.includes("fbq(") || lc.includes('facebook') || lc.includes('fbevents')) {
    const m = html.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/i);
    return { platform: 'Meta Pixel', destId: m?.[1] ?? '' };
  }
  if (lc.includes('tiktok') || lc.includes('ttq.load') || lc.includes('analytics.tiktok')) {
    const m = html.match(/ttq\.load\s*\(\s*['"]([A-Z0-9]+)['"]/i);
    return { platform: 'TikTok', destId: m?.[1] ?? '' };
  }
  if (lc.includes('hotjar') || lc.includes('hjid')) {
    const m = html.match(/hjid[:\s,]*(\d+)/i);
    return { platform: 'Hotjar', destId: m?.[1] ?? '' };
  }
  if (lc.includes('criteo') || lc.includes('rtax')) {
    const m = html.match(/['"](a|account)['"]\s*,\s*(\d+)/i) ||
              html.match(/criteo[^"']*["']([0-9]+)["']/i);
    return { platform: 'Criteo', destId: m?.[2] ?? m?.[1] ?? '' };
  }
  return { platform: 'Custom', destId: '' };
}

function buildContainerFlow(c: MonitoringContainerData): ContainerFlow {
  const varMap = new Map(c.variables.map((v) => [v.name, v]));
  const ga4Events = c.tags.filter((t) => t.type === 'gaawe')
    .map((t) => t.parameter?.find((p) => p.key === 'event_name' || p.key === 'eventName')?.value).filter(Boolean);

  const configs: ConfigNode[] = [];
  let idx = 0;
  const makeId = () => `${c.containerId}-cfg-${idx++}`;
  const makeDestId = () => `d-${idx++}`;

  for (const tag of c.tags) {
    if (tag.type === 'gaawe') continue; // events counted in GA4 config node

    if (tag.type === 'gaawc') {
      const raw = tag.parameter?.find((p) => p.key === 'measurementId')?.value ?? '';
      const isVar = isVarRef(raw);
      const vn = isVar ? varName(raw) : undefined;
      const vDef = vn ? varMap.get(vn) : undefined;
      let destinations: Destination[];
      if (vDef?.type === 'smm') {
        const ltValues = resolveLTValues(vDef);
        destinations = ltValues.length > 0
          ? ltValues.map((val) => ({ id: makeDestId(), measurementId: val, isVariable: false, fromLT: true, ltVariableName: vn }))
          : [{ id: makeDestId(), measurementId: raw, isVariable: true, variableName: vn, variableType: 'smm' }];
      } else {
        destinations = raw ? [{ id: makeDestId(), measurementId: raw, isVariable: isVar, variableName: vn, variableType: vDef?.type }] : [];
      }
      configs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'GA4',
        destinations, isMultiProperty: vDef?.type === 'smm' && destinations.length > 1,
        eventCount: ga4Events.length,
      });
    } else if (tag.type === 'awct') {
      const raw = tag.parameter?.find((p) => p.key === 'conversionId')?.value ?? '';
      const isVar = isVarRef(raw);
      configs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'Google Ads',
        destinations: raw ? [{ id: makeDestId(), measurementId: raw, isVariable: isVar, variableName: isVar ? varName(raw) : undefined }] : [],
        eventCount: 0,
      });
    } else if (tag.type === 'flc') {
      const raw = tag.parameter?.find((p) => p.key === 'dcmFloodlightConfigId')?.value ?? '';
      configs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform: 'Floodlight',
        destinations: raw ? [{ id: makeDestId(), measurementId: raw, isVariable: isVarRef(raw) }] : [],
        eventCount: 0,
      });
    } else if (tag.type === 'html') {
      const html = tag.parameter?.find((p) => p.key === 'html')?.value ?? '';
      const { platform, destId } = detectHtmlPlatform(tag.name, html);
      configs.push({
        id: makeId(), tagName: tag.name, tagType: tag.type, platform,
        destinations: destId ? [{ id: makeDestId(), measurementId: destId, isVariable: isVarRef(destId) }] : [],
        eventCount: 0,
      });
    }
    // Non-html non-standard tag types (custom templates, etc.) — skip silently
  }

  return { containerId: c.containerId, containerName: c.containerName, publicId: c.publicId, configs };
}

// ─── Layout constants ──────────────────────────────────────────────────────────

const COL_W = { container: 180, config: 200, dest: 180 };
const COL_GAP = 60;
const NODE_H = 64;
const V_GAP = 12;
const DEST_H = 48;

function totalColX(col: 'container' | 'config' | 'dest'): { x: number; w: number } {
  if (col === 'container') return { x: 0, w: COL_W.container };
  if (col === 'config') return { x: COL_W.container + COL_GAP, w: COL_W.config };
  return { x: COL_W.container + COL_GAP + COL_W.config + COL_GAP, w: COL_W.dest };
}

// ─── SVG bezier path ───────────────────────────────────────────────────────────

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cx = (x1 + x2) / 2;
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

// ─── Single flow diagram for one container ────────────────────────────────────

function ContainerFlowDiagram({ flow, highlighted, onHighlight }: {
  flow: ContainerFlow;
  highlighted: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const configs = flow.configs;

  // Layout: compute Y position for each config node and its destinations
  type NodeLayout = { cfgId: string; cfgY: number; dests: { destId: string; destY: number }[] };
  const layout: NodeLayout[] = [];
  let cursor = 0;
  for (const cfg of configs) {
    const destCount = Math.max(cfg.destinations.length, 1);
    const totalDestH = destCount * DEST_H + (destCount - 1) * V_GAP;
    const cfgCenter = cursor + Math.max(NODE_H, totalDestH) / 2;
    const destStart = cursor + (Math.max(NODE_H, totalDestH) - totalDestH) / 2;
    const dests = cfg.destinations.map((d, i) => ({
      destId: d.id,
      destY: destStart + i * (DEST_H + V_GAP) + DEST_H / 2,
    }));
    layout.push({ cfgId: cfg.id, cfgY: cfgCenter, dests });
    cursor += Math.max(NODE_H, totalDestH) + V_GAP;
  }
  if (cursor > 0) cursor -= V_GAP;

  const svgH = Math.max(NODE_H, cursor);
  const svgW = totalColX('dest').x + COL_W.dest;

  const containerY = svgH / 2;
  const { x: cfgX } = totalColX('config');
  const { x: destX } = totalColX('dest');
  const { x: contX } = totalColX('container');

  if (configs.length === 0) {
    return (
      <div className="relative select-none" style={{ height: NODE_H, minHeight: NODE_H }}>
        <div
          className="absolute flex flex-col justify-center px-3 py-2.5 rounded-xl border"
          style={{
            left: contX, top: 0,
            width: COL_W.container, height: NODE_H,
            backgroundColor: 'white',
            borderColor: 'var(--color-border)',
            boxShadow: '0 1px 4px hsl(220 20% 10% / 0.07)',
          }}
        >
          <div className="text-xs font-semibold text-foreground leading-tight">{flow.containerName}</div>
          <div className="text-[10px] font-mono text-muted-fg mt-0.5">{flow.publicId}</div>
        </div>
        <div
          className="absolute flex items-center px-3"
          style={{
            left: contX + COL_W.container + 16, top: NODE_H / 2 - 9,
            color: 'hsl(220 13% 60%)',
          }}
        >
          <span className="text-[11px] italic">Aucun tag de configuration reconnu</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative select-none" style={{ height: svgH, minHeight: NODE_H }}>
      <svg
        width={svgW}
        height={svgH}
        className="absolute inset-0 pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {/* Container → Config connectors */}
        {layout.map(({ cfgId, cfgY }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          return (
            <path
              key={`cc-${cfgId}`}
              d={bezier(contX + COL_W.container, containerY, cfgX, cfgY)}
              fill="none"
              stroke={isHl ? style.accent : 'hsl(220 13% 82%)'}
              strokeWidth={isHl ? 2 : 1.5}
              strokeDasharray={isHl ? undefined : '4 3'}
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
            />
          );
        })}

        {/* Config → Destination connectors */}
        {layout.map(({ cfgId, cfgY, dests }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          if (dests.length === 0) return null;
          return dests.map(({ destId, destY }) => (
            <path
              key={`cd-${cfgId}-${destId}`}
              d={bezier(cfgX + COL_W.config, cfgY, destX, destY)}
              fill="none"
              stroke={isHl ? style.accent : 'hsl(220 13% 82%)'}
              strokeWidth={isHl ? 2 : 1.5}
              strokeDasharray={isHl ? undefined : '4 3'}
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
            />
          ));
        })}

        {/* Arrowheads on config connectors */}
        {layout.map(({ cfgY }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          const ax = cfgX - 1;
          return (
            <polygon
              key={`arrow-c-${cfg.id}`}
              points={`${ax},${cfgY} ${ax - 7},${cfgY - 4} ${ax - 7},${cfgY + 4}`}
              fill={isHl ? style.accent : 'hsl(220 13% 75%)'}
              style={{ transition: 'fill 0.2s' }}
            />
          );
        })}

        {/* Arrowheads on destination connectors */}
        {layout.map(({ cfgId, dests }, i) => {
          const cfg = configs[i];
          const style = PLATFORM_STYLE[cfg.platform];
          const isHl = highlighted === cfg.id;
          return dests.map(({ destId, destY }) => {
            const ax = destX - 1;
            return (
              <polygon
                key={`arrow-d-${cfgId}-${destId}`}
                points={`${ax},${destY} ${ax - 7},${destY - 4} ${ax - 7},${destY + 4}`}
                fill={isHl ? style.accent : 'hsl(220 13% 75%)'}
                style={{ transition: 'fill 0.2s' }}
              />
            );
          });
        })}
      </svg>

      {/* Container node */}
      <div
        className="absolute flex flex-col justify-center px-3 py-2.5 rounded-xl border"
        style={{
          left: contX, top: containerY - NODE_H / 2,
          width: COL_W.container, height: NODE_H,
          backgroundColor: 'white',
          borderColor: 'var(--color-border)',
          boxShadow: '0 1px 4px hsl(220 20% 10% / 0.07)',
        }}
      >
        <div className="text-xs font-semibold text-foreground leading-tight">{flow.containerName}</div>
        <div className="text-[10px] font-mono text-muted-fg mt-0.5">{flow.publicId}</div>
      </div>

      {/* Config nodes */}
      {layout.map(({ cfgId, cfgY }, i) => {
        const cfg = configs[i];
        const style = PLATFORM_STYLE[cfg.platform];
        const isHl = highlighted === cfg.id;
        return (
          <div
            key={cfgId}
            className="absolute flex items-center gap-2.5 px-3 cursor-pointer rounded-xl border transition-all"
            style={{
              left: cfgX, top: cfgY - NODE_H / 2,
              width: COL_W.config, height: NODE_H,
              backgroundColor: isHl ? style.bg : 'white',
              borderColor: isHl ? style.border : 'hsl(220 13% 88%)',
              boxShadow: isHl ? `0 0 0 2px ${style.border}` : '0 1px 4px hsl(220 20% 10% / 0.06)',
            }}
            onMouseEnter={() => onHighlight(cfg.id)}
            onMouseLeave={() => onHighlight(null)}
          >
            <div className="shrink-0">
              <TagTypeIcon category={PLATFORM_ICON_CAT[cfg.platform]} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: style.color }}>
                  {cfg.platform}
                </span>
                {cfg.isMultiProperty && (
                  <span
                    className="text-[9px] font-semibold px-1 py-px rounded"
                    style={{ backgroundColor: style.border, color: style.color }}
                  >
                    {cfg.destinations.length} props
                  </span>
                )}
              </div>
              <div className="text-[11px] font-medium text-foreground truncate leading-tight">{cfg.tagName}</div>
              {cfg.platform === 'GA4' && cfg.eventCount > 0 && (
                <div className="text-[10px] text-muted-fg mt-0.5">{cfg.eventCount} event{cfg.eventCount > 1 ? 's' : ''}</div>
              )}
            </div>
          </div>
        );
      })}

      {/* Destination nodes */}
      {layout.map(({ cfgId, dests }, i) => {
        const cfg = configs[i];
        const style = PLATFORM_STYLE[cfg.platform];
        const isHl = highlighted === cfg.id;

        if (cfg.destinations.length === 0) {
          return (
            <div
              key={`dest-empty-${cfgId}`}
              className="absolute flex items-center px-3 rounded-lg border"
              style={{
                left: destX, top: dests.length > 0 ? dests[0].destY - DEST_H / 2 : layout[i].cfgY - DEST_H / 2,
                width: COL_W.dest, height: DEST_H,
                borderColor: 'var(--color-sidebar-border)', backgroundColor: 'hsl(220 13% 97%)',
              }}
            >
              <span className="text-[11px] text-muted-fg italic">Non détecté</span>
            </div>
          );
        }

        return dests.map(({ destId, destY }, di) => {
          const dest = cfg.destinations[di];
          if (!dest) return null;
          const isUnresolvedLT = dest.isVariable && dest.variableType === 'smm';
          const isFromLT = dest.fromLT;
          return (
            <div
              key={destId}
              className="absolute flex items-center gap-2 px-3 rounded-lg border transition-all"
              style={{
                left: destX, top: destY - DEST_H / 2,
                width: COL_W.dest, height: DEST_H,
                backgroundColor: isHl ? style.bg : 'var(--color-sidebar-bg)',
                borderColor: isFromLT
                  ? (isHl ? style.border : 'hsl(213 80% 85%)')
                  : (isHl ? style.border : 'hsl(220 13% 88%)'),
              }}
            >
              {isUnresolvedLT ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0" style={{ color: style.accent }}>
                  <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 6h6M3 4h6M3 8h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              ) : (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isFromLT ? 'hsl(213 80% 60%)' : (isHl ? style.accent : 'hsl(220 13% 75%)') }}
                />
              )}
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-medium truncate" style={{ color: isHl ? style.color : 'var(--color-foreground)' }}>
                  {dest.isVariable ? (dest.variableName ?? dest.measurementId) : dest.measurementId}
                </div>
                {isUnresolvedLT && (
                  <div className="text-[9px] mt-0.5" style={{ color: style.accent }}>Lookup Table non résolue</div>
                )}
                {isFromLT && dest.ltVariableName && (
                  <div className="text-[9px] mt-0.5 truncate" style={{ color: 'hsl(213 70% 50%)' }}>
                    via {dest.ltVariableName}
                  </div>
                )}
              </div>
            </div>
          );
        });
      })}
    </div>
  );
}

// ─── Cross-container alert bar ─────────────────────────────────────────────────

function AlertBar({ flows }: { flows: ContainerFlow[] }) {
  const alerts: { kind: 'gap' | 'diverge'; text: string }[] = [];

  // Event gaps
  // GA4 event count divergence
  const ga4Counts = flows
    .map((f) => ({ name: f.containerName, count: f.configs.find((c) => c.platform === 'GA4')?.eventCount ?? 0 }))
    .filter((x) => x.count > 0);
  const countSet = new Set(ga4Counts.map((x) => x.count));
  if (countSet.size > 1) {
    const min = Math.min(...ga4Counts.map((x) => x.count));
    const max = Math.max(...ga4Counts.map((x) => x.count));
    alerts.push({ kind: 'gap', text: `GA4 : couverture d'events inégale entre containers (${min}–${max} events)` });
  }

  // Destination divergence per platform
  const platformDests = new Map<Platform, { names: Set<string>; vars: number }>();
  for (const flow of flows) {
    for (const cfg of flow.configs) {
      if (!platformDests.has(cfg.platform)) platformDests.set(cfg.platform, { names: new Set(), vars: 0 });
      const pd = platformDests.get(cfg.platform)!;
      for (const d of cfg.destinations) {
        if (d.isVariable) pd.vars++;
        else pd.names.add(d.measurementId);
      }
    }
  }
  for (const [platform, { names }] of platformDests) {
    if (names.size > 1) {
      alerts.push({ kind: 'diverge', text: `${platform} : destinations différentes entre containers (${[...names].join(', ')})` });
    }
  }

  if (alerts.length === 0) return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs"
      style={{ borderColor: 'hsl(142 60% 75%)', backgroundColor: 'hsl(142 72% 97%)', color: 'var(--color-success)' }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Destinations et couverture cohérentes entre containers
    </div>
  );

  return (
    <div className="space-y-1.5">
      {alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs"
          style={a.kind === 'diverge'
            ? { borderColor: 'hsl(38 100% 80%)', backgroundColor: 'hsl(38 100% 97%)', color: 'var(--color-warning)' }
            : { borderColor: 'hsl(0 70% 80%)', backgroundColor: 'hsl(0 85% 97%)', color: 'var(--color-destructive)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            {a.kind === 'diverge'
              ? <><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></>
              : <><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>}
          </svg>
          {a.text}
        </div>
      ))}
    </div>
  );
}

// ─── Column headers ────────────────────────────────────────────────────────────

function ColumnHeaders() {
  const { x: contX, w: contW } = totalColX('container');
  const { x: cfgX, w: cfgW } = totalColX('config');
  const { x: destX, w: destW } = totalColX('dest');
  const svgW = destX + destW;

  return (
    <div className="relative shrink-0" style={{ height: 28, width: svgW }}>
      {[
        { x: contX, w: contW, label: 'Container' },
        { x: cfgX, w: cfgW, label: 'Tag de configuration' },
        { x: destX, w: destW, label: 'Destination' },
      ].map(({ x, w, label }) => (
        <div
          key={label}
          className="absolute text-[10px] font-semibold uppercase tracking-widest text-muted-fg"
          style={{ left: x, width: w, top: 4 }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DistributionTab({ containers }: { containers: MonitoringContainerData[] }) {
  const flows = useMemo(() => containers.map(buildContainerFlow), [containers]);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const svgW = totalColX('dest').x + COL_W.dest;
  const hasAny = flows.some((f) => f.configs.length > 0);

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-fg">
        <p className="text-sm">Aucun tag de configuration détecté</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Alert bar */}
      <div className="px-6 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-sidebar-border)', backgroundColor: 'var(--color-sidebar-bg)' }}>
        <AlertBar flows={flows} />
      </div>

      {/* Flow diagrams */}
      <div className="flex-1 overflow-auto px-6 py-5 space-y-8">
        {/* Column headers */}
        <ColumnHeaders />

        {flows.map((flow, i) => (
          <div key={flow.containerId}>
            {i > 0 && (
              <div className="mb-8 h-px" style={{ backgroundColor: 'hsl(220 13% 92%)', width: svgW }} />
            )}
            <ContainerFlowDiagram
              flow={flow}
              highlighted={highlighted}
              onHighlight={setHighlighted}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-2.5 border-t flex items-center gap-2 shrink-0 text-xs"
        style={{ borderColor: 'var(--color-sidebar-border)', backgroundColor: 'var(--color-sidebar-bg)', color: 'var(--color-muted-fg)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/><path d="M6 4v2.5M6 8v.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
        Survolez un tag de configuration pour mettre en évidence ses connexions · Lookup Table = destinations dynamiques non résolues sans OAuth GCP
      </div>
    </div>
  );
}
