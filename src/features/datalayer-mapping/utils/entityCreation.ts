import { resolveTagEventNames } from '../../../lib/event-chain';
import type { GTMTag, GTMTrigger, GTMVariable } from '../../../types/gtm';
import type { MonitoringContainerData } from '../../../data/monitoring-mock';
import type { DatalayerVariable } from '../types/datalayer.types';

// Builds the variable + optional trigger/tag bundle for a missing GTM Data Layer Variable
// (PRD §6, §12). Trigger/tag are only included if this event has no GA4 tag in the container
// yet — checked against the site's own scanned monitoringData (siteId === containerId, PRD §3).
// Shared by VariableDrillDown (Events tab) and EventDetailDrawer (Kanban) — same action, two entry points.
export function buildEntityCreation(v: DatalayerVariable, monitoringData: MonitoringContainerData[]) {
  const meta = monitoringData.find((d) => d.containerId === v.siteId);
  const existingTag = meta?.tags.find(
    (t) => t.type === 'gaawe' && resolveTagEventNames(t, meta.triggers).includes(v.eventName),
  );

  const variable: GTMVariable = {
    name: `DLV - ${v.variablePath}`,
    type: 'v',
    parameter: [
      { type: 'integer', key: 'dataLayerVersion', value: '2' },
      { type: 'template', key: 'name', value: v.variablePath.replace(/\[\*\]/g, '[0]') },
    ],
  };

  if (existingTag) return { variable, trigger: undefined, tag: undefined };

  // Event has no GA4 tag at all in this container — bundle the minimal trigger + tag too.
  const trigger: GTMTrigger = {
    name: `DL - ${v.eventName}`,
    type: 'CUSTOM_EVENT',
    customEventFilter: [{
      type: 'EQUALS',
      parameter: [
        { type: 'template', key: 'arg0', value: '{{_event}}' },
        { type: 'template', key: 'arg1', value: v.eventName },
      ],
    }],
  };
  const tag: GTMTag = {
    name: `GA4 - ${v.eventName}`,
    type: 'gaawe',
    parameter: [{ type: 'template', key: 'eventName', value: v.eventName }],
  };

  return { variable, trigger, tag };
}
