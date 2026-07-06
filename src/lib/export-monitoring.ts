import type { MonitoringContainerData } from '../data/monitoring-mock';
import type { GTMTag } from '../types/gtm';

function detectTagCategory(tag: GTMTag): string {
  if (tag.type === 'gaawe' || tag.type === 'gaawc') return 'GA4';
  if (tag.type === 'awct') return 'Google Ads';
  if (tag.type === 'flc') return 'Floodlight';
  if (tag.type === 'html') {
    const html = (tag.parameter?.find((p) => p.key === 'html')?.value ?? '').toLowerCase();
    if (html.includes('kameleoon')) return 'Kameleoon';
    if (html.includes('abtasty')) return 'AB Tasty';
    if (html.includes("fbq(") || html.includes('facebook')) return 'Meta Pixel';
    if (html.includes('tiktok') || html.includes('ttq.load')) return 'TikTok';
    if (html.includes('hotjar') || html.includes('hjid')) return 'Hotjar';
    return 'HTML Custom';
  }
  return 'HTML Custom';
}

function getTagRowKey(tag: GTMTag, category: string): string {
  if (category === 'GA4' && tag.type === 'gaawe') {
    return tag.parameter?.find((p) => p.key === 'event_name')?.value ?? tag.name;
  }
  if (category === 'GA4' && tag.type === 'gaawc') return 'GA4 Configuration';
  return tag.name;
}

interface CoverageRow {
  key: string;
  category: string;
  cells: Record<string, string | null>; // containerId → tag name or null
}

function buildTagCoverage(containers: MonitoringContainerData[]): CoverageRow[] {
  const rowMap = new Map<string, CoverageRow>();
  for (const c of containers) {
    for (const tag of c.tags) {
      const cat = detectTagCategory(tag);
      const rowKey = getTagRowKey(tag, cat);
      const mapKey = `${cat}::${rowKey}`;
      if (!rowMap.has(mapKey)) {
        rowMap.set(mapKey, { key: rowKey, category: cat, cells: Object.fromEntries(containers.map((x) => [x.containerId, null])) });
      }
      rowMap.get(mapKey)!.cells[c.containerId] = tag.name;
    }
  }
  return [...rowMap.values()].sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
}

interface ParamAnomaly {
  event: string;
  container: string;
  issue: string;
}

function detectParamAnomalies(containers: MonitoringContainerData[]): ParamAnomaly[] {
  const anomalies: ParamAnomaly[] = [];
  const GA4_STANDARD_PARAMS: Record<string, string[]> = {
    purchase:       ['currency', 'transaction_id', 'value', 'items'],
    add_to_cart:    ['currency', 'value', 'items'],
    view_item:      ['currency', 'items'],
    begin_checkout: ['currency', 'value', 'items'],
  };

  for (const c of containers) {
    for (const tag of c.tags) {
      if (tag.type !== 'gaawe') continue;
      const event = tag.parameter?.find((p) => p.key === 'event_name')?.value ?? '';
      const expectedParams = GA4_STANDARD_PARAMS[event];
      if (!expectedParams) continue;
      const presentKeys = new Set((tag.parameter ?? []).map((p) => p.key));
      for (const expected of expectedParams) {
        if (!presentKeys.has(expected)) {
          anomalies.push({ event, container: c.containerName, issue: `Paramètre manquant : ${expected}` });
        }
      }
      // Detect hardcoded currency
      const currencyParam = tag.parameter?.find((p) => p.key === 'currency');
      if (currencyParam && currencyParam.value && !currencyParam.value.startsWith('{{')) {
        anomalies.push({ event, container: c.containerName, issue: `currency hardcodé : "${currencyParam.value}"` });
      }
    }
  }
  return anomalies;
}

function countOrphans(c: MonitoringContainerData): { triggers: number; variables: number } {
  const usedTriggerIds = new Set<string>();
  for (const tag of c.tags) {
    for (const id of tag.firingTriggerId ?? []) usedTriggerIds.add(id);
    for (const id of tag.blockingTriggerId ?? []) usedTriggerIds.add(id);
  }
  const orphanTriggers = c.triggers.filter((t) => t.triggerId && !usedTriggerIds.has(t.triggerId)).length;

  const allText = JSON.stringify([...c.tags, ...c.triggers, ...c.variables]);
  const orphanVars = c.variables.filter((v) => !allText.includes(`{{${v.name}}}`)).length;

  return { triggers: orphanTriggers, variables: orphanVars };
}

function cell(present: boolean, name: string | null): string {
  if (!present) return `<td class="absent">Absent</td>`;
  return `<td class="present">${name ?? '—'}</td>`;
}

export function generateMonitoringReport(containers: MonitoringContainerData[]): string {
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  const coverage = buildTagCoverage(containers);
  const anomalies = detectParamAnomalies(containers);

  const containerHeaders = containers.map((c) => `<th>${c.containerName}<br><span class="pub-id">${c.publicId}</span></th>`).join('');

  // Group coverage rows by category
  const categories = [...new Set(coverage.map((r) => r.category))];

  let coverageRows = '';
  for (const cat of categories) {
    const rows = coverage.filter((r) => r.category === cat);
    coverageRows += `<tr class="cat-header"><td colspan="${containers.length + 1}">${cat}</td></tr>`;
    for (const row of rows) {
      const totalPresent = containers.filter((c) => row.cells[c.containerId] !== null).length;
      const allPresent = totalPresent === containers.length;
      coverageRows += `<tr class="${allPresent ? '' : 'has-gap'}">
        <td class="row-key">${row.key}</td>
        ${containers.map((c) => cell(row.cells[c.containerId] !== null, row.cells[c.containerId])).join('')}
      </tr>`;
    }
  }

  // Orphans summary
  const orphanRows = containers.map((c) => {
    const o = countOrphans(c);
    return `<tr>
      <td>${c.containerName}</td>
      <td class="num ${o.triggers > 0 ? 'warn' : ''}">${o.triggers}</td>
      <td class="num ${o.variables > 0 ? 'warn' : ''}">${o.variables}</td>
    </tr>`;
  }).join('');

  // Anomalies table
  const anomalyRows = anomalies.length === 0
    ? '<tr><td colspan="3" class="ok-cell">Aucune anomalie détectée</td></tr>'
    : anomalies.map((a) => `<tr><td>${a.container}</td><td><code>${a.event}</code></td><td class="warn-text">${a.issue}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport Monitoring GTM — ${now}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1a1a2e; margin: 0; padding: 32px; background: #fff; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  h2 { font-size: 14px; font-weight: 700; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e8e8f0; }
  .meta { font-size: 12px; color: #666; margin-bottom: 28px; }
  .brand { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7c3aed; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f4f4f8; font-weight: 600; padding: 7px 10px; text-align: left; border: 1px solid #e0e0ea; }
  td { padding: 6px 10px; border: 1px solid #e8e8f0; vertical-align: middle; }
  .row-key { font-weight: 600; color: #1a1a2e; min-width: 140px; }
  .present { color: #166534; background: #f0fdf4; }
  .absent { color: #b91c1c; background: #fef2f2; font-style: italic; }
  .has-gap .row-key { color: #92400e; }
  .cat-header td { background: #ede9fe; color: #5b21b6; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 10px; }
  .pub-id { font-weight: 400; font-size: 10px; color: #888; }
  .num { text-align: center; font-weight: 600; }
  .warn { color: #b91c1c; }
  .warn-text { color: #b91c1c; }
  .ok-cell { color: #166534; font-style: italic; text-align: center; padding: 12px; }
  code { background: #f4f4f8; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .summary-card { border: 1px solid #e0e0ea; border-radius: 8px; padding: 14px 16px; }
  .summary-card .val { font-size: 24px; font-weight: 700; color: #7c3aed; line-height: 1; margin-bottom: 4px; }
  .summary-card .lbl { font-size: 11px; color: #666; }
  @media print {
    body { padding: 16px; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<span class="brand">Digital Keys</span>
<h1>Rapport Monitoring GTM</h1>
<p class="meta">Généré le ${now} &bull; ${containers.length} containers analysés</p>

<div class="summary-grid">
  <div class="summary-card">
    <div class="val">${containers.length}</div>
    <div class="lbl">Containers</div>
  </div>
  <div class="summary-card">
    <div class="val">${coverage.filter(r => containers.some(c => r.cells[c.containerId] === null)).length}</div>
    <div class="lbl">Tags avec écarts de couverture</div>
  </div>
  <div class="summary-card">
    <div class="val">${anomalies.length}</div>
    <div class="lbl">Anomalies de paramètres</div>
  </div>
</div>

<h2>Matrice de couverture — Tags</h2>
<table>
  <thead><tr><th>Entité</th>${containerHeaders}</tr></thead>
  <tbody>${coverageRows}</tbody>
</table>

<h2>Anomalies de paramètres GA4</h2>
<table>
  <thead><tr><th>Container</th><th>Event</th><th>Anomalie</th></tr></thead>
  <tbody>${anomalyRows}</tbody>
</table>

<h2>Entités orphelines</h2>
<table>
  <thead><tr><th>Container</th><th>Déclencheurs orphelins</th><th>Variables orphelines</th></tr></thead>
  <tbody>${orphanRows}</tbody>
</table>
</body>
</html>`;
}
