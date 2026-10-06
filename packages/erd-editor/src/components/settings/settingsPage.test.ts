import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext, appDestroy } from '@/components/appContext';
import { Lnb } from '@/components/settings/settings-lnb/SettingsLnb';
import {
  requestSettingsPage,
  takeSettingsPage,
} from '@/components/settings/settingsPage';
import { CanvasType } from '@/constants/schema';

const apps: AppContext[] = [];

const createApp = () => {
  const app = createTestAppContext();
  apps.push(app);
  return app;
};

afterEach(() => {
  apps.forEach(appDestroy);
  apps.length = 0;
});

describe('settingsPage', () => {
  it('answers nothing where no page was asked for', () => {
    const { store } = createApp();

    expect(takeSettingsPage(store)).toBeUndefined();
  });

  it('opens the Settings tab on the page asked for', async () => {
    const { store } = createApp();
    expect(store.state.settings.canvasType).toBe(CanvasType.ERD);

    requestSettingsPage(store, Lnb.shortcuts);
    await flush();

    expect(store.state.settings.canvasType).toBe(CanvasType.settings);
    expect(takeSettingsPage(store)).toBe(Lnb.shortcuts);
  });

  it('hands the page out once, so a later visit opens where the tab starts', () => {
    const { store } = createApp();

    requestSettingsPage(store, Lnb.shortcuts);

    expect(takeSettingsPage(store)).toBe(Lnb.shortcuts);
    expect(takeSettingsPage(store)).toBeUndefined();
  });

  it('keeps the last page asked for', () => {
    const { store } = createApp();

    requestSettingsPage(store, Lnb.shortcuts);
    requestSettingsPage(store, Lnb.preferences);

    expect(takeSettingsPage(store)).toBe(Lnb.preferences);
  });

  it('keeps a request to the store it was made on', () => {
    const first = createApp();
    const second = createApp();

    requestSettingsPage(first.store, Lnb.shortcuts);

    expect(takeSettingsPage(second.store)).toBeUndefined();
    expect(takeSettingsPage(first.store)).toBe(Lnb.shortcuts);
  });
});
