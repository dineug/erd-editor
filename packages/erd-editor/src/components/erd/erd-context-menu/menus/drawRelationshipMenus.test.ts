import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  createDrawRelationshipMenus,
  menus,
} from '@/components/erd/erd-context-menu/menus/drawRelationshipMenus';
import { RelationshipType } from '@/constants/schema';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
});

describe('drawRelationshipMenus', () => {
  it('exposes the four drawable relationship types', () => {
    expect(menus.map(menu => menu.name)).toEqual([
      'Zero One',
      'Zero N',
      'One Only',
      'One N',
    ]);
    expect(menus.map(menu => menu.iconName)).toEqual([
      'ZeroOne',
      'ZeroN',
      'OneOnly',
      'OneN',
    ]);
    expect(menus.map(menu => menu.relationshipType)).toEqual([
      RelationshipType.ZeroOne,
      RelationshipType.ZeroN,
      RelationshipType.OneOnly,
      RelationshipType.OneN,
    ]);
  });

  it('reads each shortcut from the key binding map', () => {
    const result = createDrawRelationshipMenus(app, () => {});

    expect(result.map(menu => menu.shortcut)).toEqual([
      app.keyBindingMap[KeyBindingName.relationshipZeroOne][0]?.shortcut,
      app.keyBindingMap[KeyBindingName.relationshipZeroN][0]?.shortcut,
      app.keyBindingMap[KeyBindingName.relationshipOneOnly][0]?.shortcut,
      app.keyBindingMap[KeyBindingName.relationshipOneN][0]?.shortcut,
    ]);
    expect(result[0].shortcut).toBeTruthy();
  });

  it('yields undefined shortcut when the binding has no entry', () => {
    app.keyBindingMap[KeyBindingName.relationshipZeroOne] = [];

    const result = createDrawRelationshipMenus(app, () => {});

    expect(result[0].shortcut).toBeUndefined();
  });

  it('starts drawing the chosen relationship and closes the menu', async () => {
    const onClose = vi.fn();

    createDrawRelationshipMenus(app, onClose)[1].onClick();
    await flush();

    expect(app.store.state.editor.drawRelationship).toMatchObject({
      relationshipType: RelationshipType.ZeroN,
      start: null,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ends drawing when the same relationship type is picked twice', async () => {
    const onClose = vi.fn();

    createDrawRelationshipMenus(app, onClose)[3].onClick();
    await flush();
    expect(app.store.state.editor.drawRelationship?.relationshipType).toBe(
      RelationshipType.OneN
    );

    createDrawRelationshipMenus(app, onClose)[3].onClick();
    await flush();

    expect(app.store.state.editor.drawRelationship).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('switches the draw type when a different entry is picked', async () => {
    const onClose = vi.fn();

    createDrawRelationshipMenus(app, onClose)[0].onClick();
    await flush();
    createDrawRelationshipMenus(app, onClose)[2].onClick();
    await flush();

    expect(app.store.state.editor.drawRelationship?.relationshipType).toBe(
      RelationshipType.OneOnly
    );
  });
});
