import { PanelConfig } from '@@types/core/panel';
import { observable } from '@vuerd/lit-observable';

export const panels: PanelConfig[] = observable([]);

export const addPanel = (...newPanels: PanelConfig[]) =>
  panels.push(...newPanels);
