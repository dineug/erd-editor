import { recordConnectorDrift } from '../support/connectorDrift';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  RelationshipType,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

const key = (id: string) => ({
  id,
  name: 'id',
  dataType: 'int',
  options: ColumnOption.primaryKey | ColumnOption.notNull,
  keys: ColumnUIKey.primaryKey,
});

/** Alpha joined to beta, with room below and left of beta to carry it into. */
const joinedPair = () =>
  createSchema({
    tables: [
      { id: 'A', name: 'alpha', x: 100, y: 100, columns: [key('A_id')] },
      {
        id: 'B',
        name: 'beta',
        x: 700,
        y: 150,
        columns: [
          key('B_id'),
          {
            id: 'B_a',
            name: 'alpha_id',
            dataType: 'int',
            keys: ColumnUIKey.foreignKey,
          },
        ],
      },
    ],
    relationships: [
      {
        id: 'ab',
        relationshipType: RelationshipType.OneN,
        startTableId: 'A',
        startColumnIds: ['A_id'],
        endTableId: 'B',
        endColumnIds: ['B_a'],
      },
    ],
  });

test.describe('connectors in the frame an edit lands', () => {
  // History keeps a drag as one move of the same type the drag streamed, so a
  // sort that told them apart by type waited a timer after the undo keystroke,
  // and the frame before it drew beta back in place with the connector still out.
  test('draws no connector off its tables in the frame the undo or redo of a drag lands', async ({
    erd,
  }) => {
    await erd.seed(joinedPair());
    const header = await erd.tableHeaderPoint('B');
    await erd.drag(
      header,
      { x: header.x - 250, y: header.y + 350 },
      { steps: 20 }
    );
    await erd.page.mouse.move(20, 880);
    // The drag reaches the history once its stream settles, not on the drop.
    await expect(erd.toolbarButton('Undo')).toHaveClass(/\bactive\b/);
    await erd.whenDrawn();
    const moved = (await erd.table('B')).ui;
    const drifts = await recordConnectorDrift(erd);

    await erd.press(Shortcut.undo);
    await expect.poll(async () => (await erd.table('B')).ui.y).toBe(150);
    await erd.whenDrawn();
    const undone = await drifts();

    await expect(erd.toolbarButton('Redo')).toHaveClass(/\bactive\b/);
    await erd.press(Shortcut.redo);
    await expect.poll(async () => (await erd.table('B')).ui.y).toBe(moved.y);
    await erd.whenDrawn();
    const redone = await drifts();

    expect(moved.y).toBeGreaterThan(150);
    expect(undone.length).toBeGreaterThan(0);
    expect(redone.length).toBeGreaterThan(0);
    expect(undone.filter(drift => drift > 6)).toEqual([]);
    expect(redone.filter(drift => drift > 6)).toEqual([]);
  });
});
