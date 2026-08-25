import { AnyAction } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { AppContext } from '@/components/appContext';
import { Emitter } from '@/utils/emitter';
import {
  importDBML,
  importDiffJSON,
  importGraphQL,
  importJSON,
  importSchemaSQL,
  setImportFileCallback,
} from '@/utils/file/importFile';

type Harness = {
  app: AppContext;
  dispatch: ReturnType<typeof vi.fn>;
  emitted: AnyAction[];
  inputs: HTMLInputElement[];
  clicks: number;
};

const originalCreateElement = document.createElement.bind(document);

function createHarness(): Harness {
  const dispatch = vi.fn();
  const emitted: AnyAction[] = [];
  const emitter = new Emitter();
  vi.spyOn(emitter, 'emit').mockImplementation(action => {
    emitted.push(action);
  });

  const inputs: HTMLInputElement[] = [];
  const harness: Harness = {
    app: { store: { dispatch }, emitter } as unknown as AppContext,
    dispatch,
    emitted,
    inputs,
    clicks: 0,
  };

  vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
    const element = originalCreateElement(tagName);
    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      vi.spyOn(input, 'click').mockImplementation(() => {
        harness.clicks += 1;
      });
      inputs.push(input);
    }
    return element;
  });

  return harness;
}

function attachFile(input: HTMLInputElement, name: string, content: string) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File([content], name));
  input.files = dataTransfer.files;
}

async function change(input: HTMLInputElement) {
  input.dispatchEvent(new Event('change'));
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

describe('importFile', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    setImportFileCallback(null);
    vi.restoreAllMocks();
  });

  describe('setImportFileCallback', () => {
    it('short-circuits importJSON with a json/set descriptor', () => {
      const callback = vi.fn();
      setImportFileCallback(callback);

      importJSON(harness.app);

      expect(callback).toHaveBeenCalledWith({
        type: 'json',
        op: 'set',
        accept: '.json',
      });
      expect(harness.inputs).toHaveLength(0);
      expect(harness.clicks).toBe(0);
    });

    it('short-circuits importSchemaSQL with a sql/set descriptor', () => {
      const callback = vi.fn();
      setImportFileCallback(callback);

      importSchemaSQL(harness.app);

      expect(callback).toHaveBeenCalledWith({
        type: 'sql',
        op: 'set',
        accept: '.sql',
      });
      expect(harness.inputs).toHaveLength(0);
    });

    it('short-circuits importGraphQL with a graphql/set descriptor', () => {
      const callback = vi.fn();
      setImportFileCallback(callback);

      importGraphQL(harness.app);

      expect(callback).toHaveBeenCalledWith({
        type: 'graphql',
        op: 'set',
        accept: '.graphql,.gql,.graphqls',
      });
      expect(harness.inputs).toHaveLength(0);
      expect(harness.clicks).toBe(0);
    });

    it('short-circuits importDBML with a dbml/set descriptor', () => {
      const callback = vi.fn();
      setImportFileCallback(callback);

      importDBML(harness.app);

      expect(callback).toHaveBeenCalledWith({
        type: 'dbml',
        op: 'set',
        accept: '.dbml',
      });
      expect(harness.inputs).toHaveLength(0);
      expect(harness.clicks).toBe(0);
    });

    it('short-circuits importDiffJSON with a json/diff descriptor', () => {
      const callback = vi.fn();
      setImportFileCallback(callback);

      importDiffJSON(harness.app);

      expect(callback).toHaveBeenCalledWith({
        type: 'json',
        op: 'diff',
        accept: '.json',
      });
      expect(harness.inputs).toHaveLength(0);
    });

    it('restores the built-in file input once cleared', () => {
      setImportFileCallback(vi.fn());
      setImportFileCallback(null);

      importJSON(harness.app);

      expect(harness.inputs).toHaveLength(1);
      expect(harness.clicks).toBe(1);
    });
  });

  describe('importJSON', () => {
    it('creates and clicks a .json file input', () => {
      importJSON(harness.app);

      const [input] = harness.inputs;
      expect(input.getAttribute('type')).toBe('file');
      expect(input.getAttribute('accept')).toBe('.json');
      expect(harness.clicks).toBe(1);
    });

    it('dispatches loadJsonAction$ with the file text', async () => {
      importJSON(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'schema.JSON', '{"version":"3.0.0"}');

      await change(input);

      expect(harness.dispatch).toHaveBeenCalledTimes(1);
      const generatorAction = harness.dispatch.mock.calls[0][0];
      expect(typeof generatorAction).toBe('function');
      const yielded = [...generatorAction({} as any, {} as any)];
      expect(yielded[0]).toEqual({ type: 'editor.clear', payload: undefined });
      expect(yielded[1]).toEqual({
        type: 'editor.loadJson',
        payload: { value: '{"version":"3.0.0"}' },
      });
      expect(harness.emitted).toHaveLength(0);
    });

    it('does nothing when no file is selected', async () => {
      importJSON(harness.app);
      const [input] = harness.inputs;

      await change(input);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(0);
    });

    it('emits a toast when the extension is not .json', async () => {
      importJSON(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'schema.sql', 'CREATE TABLE a;');

      await change(input);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(1);
      expect(harness.emitted[0].type).toBe('openToast');
    });

    it('ignores a non-string FileReader result', async () => {
      const readers: any[] = [];
      class FakeFileReader {
        result: unknown = null;
        onload: (() => void) | null = null;
        constructor() {
          readers.push(this);
        }
        readAsText() {
          this.result = new ArrayBuffer(4);
          queueMicrotask(() => this.onload?.());
        }
      }
      vi.stubGlobal('FileReader', FakeFileReader);

      importJSON(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'schema.json', '{}');

      await change(input);

      expect(readers).toHaveLength(1);
      expect(harness.dispatch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('importSchemaSQL', () => {
    it('creates and clicks a .sql file input', () => {
      importSchemaSQL(harness.app);

      const [input] = harness.inputs;
      expect(input.getAttribute('type')).toBe('file');
      expect(input.getAttribute('accept')).toBe('.sql');
      expect(harness.clicks).toBe(1);
    });

    it('dispatches loadSchemaSQLAction$ with the file text', async () => {
      importSchemaSQL(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'dump.SQL', 'CREATE TABLE a (id int);');

      await change(input);

      expect(harness.dispatch).toHaveBeenCalledTimes(1);
      expect(typeof harness.dispatch.mock.calls[0][0]).toBe('function');
      expect(harness.emitted).toHaveLength(0);
    });

    it('does nothing when no file is selected', async () => {
      importSchemaSQL(harness.app);

      await change(harness.inputs[0]);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(0);
    });

    it('emits a toast when the extension is not .sql', async () => {
      importSchemaSQL(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'dump.json', '{}');

      await change(input);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(1);
      expect(harness.emitted[0].type).toBe('openToast');
    });

    it('ignores a non-string FileReader result', async () => {
      class FakeFileReader {
        result: unknown = null;
        onload: (() => void) | null = null;
        readAsText() {
          this.result = new ArrayBuffer(4);
          queueMicrotask(() => this.onload?.());
        }
      }
      vi.stubGlobal('FileReader', FakeFileReader);

      importSchemaSQL(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'dump.sql', 'select 1;');

      await change(input);

      expect(harness.dispatch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('importGraphQL', () => {
    const sdl = 'type User {\n  id: ID!\n}';

    it('creates and clicks a file input accepting every SDL extension', () => {
      importGraphQL(harness.app);

      const [input] = harness.inputs;
      expect(input.getAttribute('type')).toBe('file');
      expect(input.getAttribute('accept')).toBe('.graphql,.gql,.graphqls');
      expect(harness.clicks).toBe(1);
    });

    it.each(['schema.graphql', 'schema.GQL', 'schema.graphqls'])(
      'dispatches loadSchemaGraphQLAction$ for %s',
      async name => {
        importGraphQL(harness.app);
        const [input] = harness.inputs;
        attachFile(input, name, sdl);

        await change(input);

        expect(harness.dispatch).toHaveBeenCalledTimes(1);
        expect(typeof harness.dispatch.mock.calls[0][0]).toBe('function');
        expect(harness.emitted).toHaveLength(0);
      }
    );

    it('does nothing when no file is selected', async () => {
      importGraphQL(harness.app);

      await change(harness.inputs[0]);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(0);
    });

    it('emits a toast when the extension is not an SDL one', async () => {
      importGraphQL(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'schema.prisma', sdl);

      await change(input);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(1);
      expect(harness.emitted[0].type).toBe('openToast');
    });

    it('dispatches whatever the file holds, as the SQL import does', async () => {
      importGraphQL(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'query.graphql', 'query GetUser { user { id } }');

      await change(input);

      expect(harness.dispatch).toHaveBeenCalledTimes(1);
      expect(harness.emitted).toHaveLength(0);
    });

    it('ignores a non-string FileReader result', async () => {
      const readers: any[] = [];
      class FakeFileReader {
        result: unknown = null;
        onload: (() => void) | null = null;
        constructor() {
          readers.push(this);
        }
        readAsText() {
          this.result = new ArrayBuffer(4);
          queueMicrotask(() => this.onload?.());
        }
      }
      vi.stubGlobal('FileReader', FakeFileReader);

      importJSON(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'schema.json', '{}');

      await change(input);

      expect(readers).toHaveLength(1);
      expect(harness.dispatch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('importDBML', () => {
    const dbml = 'Table users {\n  id int [pk]\n}';

    it('creates and clicks a file input accepting the dbml extension', () => {
      importDBML(harness.app);

      const [input] = harness.inputs;
      expect(input.getAttribute('type')).toBe('file');
      expect(input.getAttribute('accept')).toBe('.dbml');
      expect(harness.clicks).toBe(1);
    });

    it.each(['schema.dbml', 'schema.DBML'])(
      'dispatches loadSchemaDBMLAction$ for %s',
      async name => {
        importDBML(harness.app);
        const [input] = harness.inputs;
        attachFile(input, name, dbml);

        await change(input);

        expect(harness.dispatch).toHaveBeenCalledTimes(1);
        expect(typeof harness.dispatch.mock.calls[0][0]).toBe('function');
        expect(harness.emitted).toHaveLength(0);
      }
    );

    it('does nothing when no file is selected', async () => {
      importDBML(harness.app);

      await change(harness.inputs[0]);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(0);
    });

    it('emits a toast when the extension is not dbml', async () => {
      importDBML(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'schema.sql', dbml);

      await change(input);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(1);
      expect(harness.emitted[0].type).toBe('openToast');
    });

    it('rejects a name ending in dbml without the dot', async () => {
      importDBML(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'schemadbml', dbml);

      await change(input);

      expect(harness.dispatch).not.toHaveBeenCalled();
      expect(harness.emitted).toHaveLength(1);
    });
  });

  describe('importDiffJSON', () => {
    it('creates and clicks a .json file input', () => {
      importDiffJSON(harness.app);

      const [input] = harness.inputs;
      expect(input.getAttribute('type')).toBe('file');
      expect(input.getAttribute('accept')).toBe('.json');
      expect(harness.clicks).toBe(1);
    });

    it('emits openDiffViewer with the file text', async () => {
      importDiffJSON(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'other.json', '{"version":"3.0.0"}');

      await change(input);

      expect(harness.emitted).toHaveLength(1);
      expect(harness.emitted[0]).toEqual({
        type: 'openDiffViewer',
        payload: { value: '{"version":"3.0.0"}' },
      });
      expect(harness.dispatch).not.toHaveBeenCalled();
    });

    it('does nothing when no file is selected', async () => {
      importDiffJSON(harness.app);

      await change(harness.inputs[0]);

      expect(harness.emitted).toHaveLength(0);
    });

    it('emits a toast when the extension is not .json', async () => {
      importDiffJSON(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'other.txt', 'nope');

      await change(input);

      expect(harness.emitted).toHaveLength(1);
      expect(harness.emitted[0].type).toBe('openToast');
    });

    it('ignores a non-string FileReader result', async () => {
      class FakeFileReader {
        result: unknown = null;
        onload: (() => void) | null = null;
        readAsText() {
          this.result = new ArrayBuffer(4);
          queueMicrotask(() => this.onload?.());
        }
      }
      vi.stubGlobal('FileReader', FakeFileReader);

      importDiffJSON(harness.app);
      const [input] = harness.inputs;
      attachFile(input, 'other.json', '{}');

      await change(input);

      expect(harness.emitted).toHaveLength(0);
      vi.unstubAllGlobals();
    });
  });
});
