import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type {
  ErdEditorElement,
  ErdViewerElement,
  LocaleCode,
  LocaleOption,
  SchemaSQLOptions,
} from '@/index';
import * as index from '@/index';
import { exportJSON } from '@/utils/file/exportFile';
import { importJSON } from '@/utils/file/importFile';

afterEach(() => {
  index.setExportFileCallback(null);
  index.setImportFileCallback(null);
});

describe('@dineug/erd-editor entry point', () => {
  it('exposes exactly the documented public surface', () => {
    expect(Object.keys(index).sort()).toEqual([
      'ErdEditorElement',
      'ErdViewerElement',
      'createKeyBindingMap',
      'defineErdEditor',
      'defineErdViewer',
      'dictionaryRowChords',
      'setExportFileCallback',
      'setImportFileCallback',
    ]);
  });

  it('defines neither tag, so neither class constructs until its define runs', () => {
    expect(customElements.get('erd-editor')).toBeUndefined();
    expect(customElements.get('erd-viewer')).toBeUndefined();
    expect(() => new index.ErdEditorElement()).toThrow();
    expect(() => new index.ErdViewerElement()).toThrow();
  });

  it('types each exported class by the interface it constructs, and both define functions', () => {
    expectTypeOf<
      InstanceType<typeof index.ErdEditorElement>
    >().toEqualTypeOf<ErdEditorElement>();
    expectTypeOf<
      InstanceType<typeof index.ErdViewerElement>
    >().toEqualTypeOf<ErdViewerElement>();
    expectTypeOf(index.defineErdEditor).toEqualTypeOf<() => void>();
    expectTypeOf(index.defineErdViewer).toEqualTypeOf<() => void>();
    expect(index.ErdViewerElement.observedAttributes).toEqual([
      'src',
      'nameView',
      'minimap',
      'controls',
      'name-view',
    ]);
  });

  it('types value as the file form to set and runtimeValue as a read-only string', () => {
    const assignRuntimeValue = (element: ErdEditorElement) => {
      // @ts-expect-error the runtime value is read, never assigned
      element.runtimeValue = '';
    };

    expectTypeOf<ErdEditorElement['value']>().toEqualTypeOf<string>();
    expectTypeOf<ErdEditorElement['runtimeValue']>().toEqualTypeOf<string>();
    expect(assignRuntimeValue).toBeTypeOf('function');
  });

  it('types a schema setter as returning a Promise only where it places first', () => {
    const placement = 'auto' as 'auto' | 'grid';

    expectTypeOf((editor: ErdEditorElement) =>
      editor.setSchemaSQL('', { placement: 'auto' })
    ).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf((editor: ErdEditorElement) =>
      editor.setSchemaGraphQL('', { placement: 'grid' })
    ).returns.toEqualTypeOf<void>();
    expectTypeOf((editor: ErdEditorElement) =>
      editor.setSchemaDBML('')
    ).returns.toEqualTypeOf<void>();
    expectTypeOf((editor: ErdEditorElement) =>
      editor.setSchemaAML('', { placement })
    ).returns.toEqualTypeOf<Promise<void> | void>();
  });

  it('types the import mode on every schema setter and on setSchemaJSON', () => {
    expectTypeOf((editor: ErdEditorElement) =>
      editor.setSchemaSQL('', { mode: 'append', placement: 'auto' })
    ).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf((editor: ErdEditorElement) =>
      editor.setSchemaDBML('', { mode: 'append' })
    ).returns.toEqualTypeOf<void>();
    expectTypeOf<ErdEditorElement['setSchemaJSON']>().parameters.toEqualTypeOf<
      [value: string, options?: { mode?: 'replace' | 'append' }]
    >();
    expectTypeOf<
      ErdEditorElement['setSchemaJSON']
    >().returns.toEqualTypeOf<void>();
  });

  it('types the display language setters, which the hosts check their own lists against', () => {
    expectTypeOf<ErdEditorElement['setLocale']>()
      .parameter(0)
      .toEqualTypeOf<LocaleOption>();
    expectTypeOf<ErdEditorElement['setSystemLocale']>()
      .parameter(0)
      .toEqualTypeOf<string | null>();
    expectTypeOf<LocaleOption>().toEqualTypeOf<LocaleCode | 'system'>();
    expectTypeOf<'ko-KR'>().toExtend<LocaleCode>();
    expectTypeOf<'ko'>().not.toExtend<LocaleCode>();
  });

  it('types getSchemaSQL’s options as SchemaSQLOptions, the statements, the header and the logical name comments', () => {
    expectTypeOf<ErdEditorElement['getSchemaSQL']>()
      .parameter(1)
      .toEqualTypeOf<SchemaSQLOptions | undefined>();
    expectTypeOf<SchemaSQLOptions>().toEqualTypeOf<{
      statements?: 'create' | 'ifNotExists' | 'recreate';
      header?: 'none' | 'use' | 'createAndUse';
      logicalNameAsComment?: boolean;
    }>();
  });

  it('exports the default key bindings, a fresh map on every call', () => {
    const keyBindingMap = index.createKeyBindingMap();

    expect(keyBindingMap.search).toEqual([
      { shortcut: '$mod+KeyK', preventDefault: true, stopPropagation: true },
    ]);
    expect(keyBindingMap.addColumn).toEqual([
      { shortcut: 'Alt+Enter', preventDefault: true },
    ]);
    expect(index.createKeyBindingMap()).toEqual(keyBindingMap);
    expect(index.createKeyBindingMap()).not.toBe(keyBindingMap);
  });

  it('re-exports setExportFileCallback so exports can be intercepted', () => {
    const performExport = vi.fn();
    index.setExportFileCallback(performExport);

    exportJSON('{"version":"3.0.0"}', 'my-schema');

    expect(performExport).toHaveBeenCalledTimes(1);
    const [blob, options] = performExport.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(options.fileName).toMatch(/^my-schema-.+\.erd\.json$/);
  });

  it('re-exports setImportFileCallback so imports can be intercepted', () => {
    const performImport = vi.fn();
    index.setImportFileCallback(performImport);

    importJSON(createTestAppContext());

    expect(performImport).toHaveBeenCalledWith({
      type: 'json',
      op: 'set',
      accept: '.json',
    });
  });
});
