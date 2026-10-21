import { describe, expect, it } from 'vite-plus/test';

import { isReadableDiagram } from '@/readableDiagram';

describe('isReadableDiagram', () => {
  it('reads an empty file as a new diagram', () => {
    expect(isReadableDiagram('')).toBe(true);
    expect(isReadableDiagram(' \n')).toBe(true);
  });

  it('reads a v3 document by its doc, or by its settings without one', () => {
    expect(isReadableDiagram('{"version":"3.0.0","doc":{}}')).toBe(true);
    expect(isReadableDiagram('{"version":"3.0.0","settings":{}}')).toBe(true);
    expect(isReadableDiagram('{"doc":{}}')).toBe(true);
  });

  it('reads the v2 document by its canvas', () => {
    expect(isReadableDiagram('{"canvas":{},"table":{}}')).toBe(true);
  });

  it('refuses text that is not JSON, and JSON that is no diagram', () => {
    expect(isReadableDiagram('{"doc": <<<<<<< HEAD')).toBe(false);
    expect(isReadableDiagram('[]')).toBe(false);
    expect(isReadableDiagram('null')).toBe(false);
    expect(isReadableDiagram('"doc"')).toBe(false);
    expect(isReadableDiagram('{"settings":{}}')).toBe(false);
    expect(isReadableDiagram('{"version":"2.0.0","settings":{}}')).toBe(false);
    expect(isReadableDiagram('{"version":"3.0.0","settings":[]}')).toBe(false);
    expect(isReadableDiagram('{"version":"3.0.0","settings":1}')).toBe(false);
  });
});
