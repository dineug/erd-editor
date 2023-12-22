import { observable } from '@vuerd/lit-observable';

import { PanelConfig } from '@@types/core/panel';

export const contextPanelConfig = observable({
  panels: [] as PanelConfig[],
  exclude: [] as RegExp[],
});

export const addPanel = (...newPanels: PanelConfig[]) =>
  contextPanelConfig.panels.push(...newPanels);

export const setExcludePanel = (exclude: RegExp[]) =>
  (contextPanelConfig.exclude = exclude);
