import type { GTMTag, GTMVariable, GTMTrigger } from '../types/gtm';

// GTM built-in variable display name → API `type` enum. Covers the ones that
// actually show up in tracking configs (click/form/history/scroll/video/page).
// Not exhaustive (AMP-specific and mobile-app variables omitted — out of scope for PFS web containers).
export const BUILTIN_DISPLAY_TO_TYPE: Record<string, string> = {
  'Page URL': 'pageUrl',
  'Page Hostname': 'pageHostname',
  'Page Path': 'pagePath',
  'Referrer': 'referrer',
  'Event': 'event',
  'Click Element': 'clickElement',
  'Click Classes': 'clickClasses',
  'Click ID': 'clickId',
  'Click Target': 'clickTarget',
  'Click URL': 'clickUrl',
  'Click Text': 'clickText',
  'Form Element': 'formElement',
  'Form Classes': 'formClasses',
  'Form ID': 'formId',
  'Form Target': 'formTarget',
  'Form URL': 'formUrl',
  'Form Text': 'formText',
  'Error Message': 'errorMessage',
  'Error URL': 'errorUrl',
  'Error Line': 'errorLine',
  'New History URL': 'newHistoryUrl',
  'Old History URL': 'oldHistoryUrl',
  'New History Fragment': 'newHistoryFragment',
  'Old History Fragment': 'oldHistoryFragment',
  'New History State': 'newHistoryState',
  'Old History State': 'oldHistoryState',
  'History Source': 'historySource',
  'Container ID': 'containerId',
  'Container Version': 'containerVersion',
  'Debug Mode': 'debugMode',
  'Random Number': 'randomNumber',
  'HTML ID': 'htmlId',
  'Environment Name': 'environmentName',
  'Video Provider': 'videoProvider',
  'Video URL': 'videoUrl',
  'Video Title': 'videoTitle',
  'Video Duration': 'videoDuration',
  'Video Percent': 'videoPercent',
  'Video Visible': 'videoVisible',
  'Video Status': 'videoStatus',
  'Video Current Time': 'videoCurrentTime',
  'Scroll Depth Threshold': 'scrollDepthThreshold',
  'Scroll Depth Units': 'scrollDepthUnits',
  'Scroll Depth Direction': 'scrollDepthDirection',
  'Percent Scrolled': 'scrollDepthThreshold',
  'Element Visibility Ratio': 'elementVisibilityRatio',
  'Element Visibility Time': 'elementVisibilityTime',
  'Element Visibility First Time': 'elementVisibilityFirstTime',
};

// Walks every string-valued field of a GTM parameter tree (nested LIST/MAP included)
// and collects raw strings — {{...}} references live inside `value` fields at any depth.
export function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, out));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((v) => collectStrings(v, out));
  }
}

const TEMPLATE_REF = /\{\{\s*([^{}]+?)\s*\}\}/g;

// Returns the GTM built-in variable `type` values referenced anywhere in the given
// entities (tags + triggers — variables can reference them too, e.g. a Lookup Table keyed on Click URL).
export function detectRequiredBuiltInVariables(entities: {
  tags: GTMTag[];
  variables: GTMVariable[];
  triggers: GTMTrigger[];
}): Set<string> {
  const strings: string[] = [];
  collectStrings(entities.tags, strings);
  collectStrings(entities.variables, strings);
  collectStrings(entities.triggers, strings);

  const required = new Set<string>();
  for (const s of strings) {
    for (const match of s.matchAll(TEMPLATE_REF)) {
      const type = BUILTIN_DISPLAY_TO_TYPE[match[1].trim()];
      if (type) required.add(type);
    }
  }
  return required;
}
