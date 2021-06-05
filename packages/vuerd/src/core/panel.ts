import { observable } from '@vuerd/lit-observable';

import { PanelConfig } from '@@types/core/panel';

export const panels: PanelConfig[] = observable([]);

export const addPanel = (...newPanels: PanelConfig[]) =>
  panels.push(...newPanels);
