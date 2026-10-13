import { observer } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush } from '@/__test-utils__';

import {
  clearRelationshipHighlight,
  dropRelationshipHighlight,
  isRelationshipHighlighted,
  setRelationshipHighlight,
} from './relationshipHighlight';

afterEach(() => {
  dropRelationshipHighlight('editor-a');
  dropRelationshipHighlight('editor-b');
});

describe('relationshipHighlight', () => {
  it('lights one relationship per editor and puts out the one before', () => {
    setRelationshipHighlight('editor-a', 'rel-1');
    setRelationshipHighlight('editor-a', 'rel-2');

    expect(isRelationshipHighlighted('editor-a', 'rel-1')).toBe(false);
    expect(isRelationshipHighlighted('editor-a', 'rel-2')).toBe(true);
  });

  it('keeps each editor apart, as the diff viewer two panes and two elements are', () => {
    setRelationshipHighlight('editor-a', 'rel-1');

    expect(isRelationshipHighlighted('editor-b', 'rel-1')).toBe(false);
  });

  it('puts everything out on clear, and clearing an editor never lit does nothing', () => {
    setRelationshipHighlight('editor-a', 'rel-1');

    clearRelationshipHighlight('editor-a');
    clearRelationshipHighlight('editor-never');

    expect(isRelationshipHighlighted('editor-a', 'rel-1')).toBe(false);
  });

  it('wakes only the connectors whose own key changed', async () => {
    setRelationshipHighlight('editor-a', 'rel-1');
    const runs = { 'rel-1': 0, 'rel-2': 0, 'rel-3': 0 };
    const stops = (Object.keys(runs) as Array<keyof typeof runs>).map(id =>
      observer(() => {
        runs[id]++;
        isRelationshipHighlighted('editor-a', id);
      })
    );
    const before = { ...runs };

    setRelationshipHighlight('editor-a', 'rel-2');
    await flush();

    expect(runs['rel-1']).toBe(before['rel-1'] + 1);
    expect(runs['rel-2']).toBe(before['rel-2'] + 1);
    expect(runs['rel-3']).toBe(before['rel-3']);
    stops.forEach(stop => stop());
  });

  it('forgets an editor that went', () => {
    setRelationshipHighlight('editor-a', 'rel-1');

    dropRelationshipHighlight('editor-a');

    expect(isRelationshipHighlighted('editor-a', 'rel-1')).toBe(false);
  });
});
