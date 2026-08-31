/** @jsxHost konva */

import {
  cache,
  createRef,
  type DOMTemplateLiterals,
  type FC,
  nextTick,
  onMounted,
  onUpdated,
  ref,
  repeat,
} from '@dineug/r-html';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { konva, renderKonva } from '@/konva/host';

type Scene = {
  className: string;
  attrs: Record<string, any>;
  children: Scene[];
};

const stages: Stage[] = [];

/** Let the r-html scheduler and pending microtasks drain. */
async function flush(ticks = 3) {
  for (let i = 0; i < ticks; i++) {
    await nextTick(() => {});
    await Promise.resolve();
  }
}

/**
 * The whole of a Konva subtree as plain data: class, attrs and children in
 * order. Virtual markers are absent by construction, so a serialized tree also
 * proves the ledger kept them out of the scene.
 */
function serialize(node: KonvaNode): Scene {
  const container = node as unknown as {
    getChildren?: () => KonvaNode[];
  };

  return {
    className: node.getClassName(),
    attrs: { ...node.attrs },
    children: container.getChildren
      ? container.getChildren().map(serialize)
      : [],
  };
}

const sceneOf = (stage: Stage): Scene[] => stage.getChildren().map(serialize);

function mount(template: DOMTemplateLiterals | null): Stage {
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({ container, width: 300, height: 300 });
  stages.push(stage);
  renderKonva(stage, template);
  return stage;
}

async function draw(template: DOMTemplateLiterals): Promise<Stage> {
  const stage = mount(template);
  await flush();
  return stage;
}

/**
 * Renders both spellings into two Stages of their own, asserts the Konva node
 * trees match and hands back the JSX one. Konva has no markup, so the picture
 * compared is the serialized tree rather than a string.
 */
async function both(
  jsx: DOMTemplateLiterals,
  tagged: DOMTemplateLiterals
): Promise<Stage> {
  const a = await draw(jsx);
  const b = await draw(tagged);
  const scene = sceneOf(a);
  expect(scene.length).toBeGreaterThan(0);
  expect(scene).toEqual(sceneOf(b));
  return a;
}

afterEach(() => {
  while (stages.length) {
    const stage = stages.pop();
    if (!stage) continue;

    const container = stage.container();
    renderKonva(stage, null);
    stage.destroy();
    container.remove();
  }
});

type ProbeProps = {
  fill: string;
  size?: number;
};

const Probe: FC<ProbeProps> = props => () => (
  <k-rect fill={props.fill} width={props.size ?? 0} height={props.size ?? 0} />
);

const Slotted: FC<{ children?: DOMTemplateLiterals }> = props => () => (
  <k-group name={'slotted'}>{props.children}</k-group>
);

describe('konva scene parity', () => {
  it('keeps a static attribute static', async () => {
    const stage = await both(
      <k-layer>
        <k-rect fill="red" stroke="blue" />
      </k-layer>,
      konva`<k-layer><k-rect fill="red" stroke="blue"></k-rect></k-layer>`
    );

    expect(stage.findOne('Rect')?.getAttr('stroke')).toBe('blue');
  });

  it('passes a single-marker attribute through as its raw value', async () => {
    const stage = await both(
      <k-layer>
        <k-rect x={10} y={20} />
      </k-layer>,
      konva`<k-layer><k-rect x=${10} y=${20}></k-rect></k-layer>`
    );

    expect(stage.findOne('Rect')?.getAttr('x')).toBe(10);
  });

  it('nests groups', async () => {
    await both(
      <k-layer>
        <k-group x={4}>
          <k-rect width={8} height={9} />
        </k-group>
      </k-layer>,
      konva`<k-layer><k-group x=${4}><k-rect width=${8} height=${9}></k-rect></k-group></k-layer>`
    );
  });

  it('composes a mixed static and dynamic attribute the same way', async () => {
    const width = 10;
    const stage = await both(
      <k-layer>
        <k-text text={`w ${width}`} />
      </k-layer>,
      konva`<k-layer><k-text text="w ${width}"></k-text></k-layer>`
    );

    expect(stage.findOne('Text')?.getAttr('text')).toBe('w 10');
  });

  it('renders an array of templates', async () => {
    const rows = ['a', 'b', 'c'];
    const stage = await both(
      <k-layer>
        {rows.map(row => (
          <k-rect name={row} />
        ))}
      </k-layer>,
      konva`<k-layer>${rows.map(
        row => konva`<k-rect name=${row}></k-rect>`
      )}</k-layer>`
    );

    expect(stage.getChildren()[0].getChildren()).toHaveLength(3);
  });

  it('renders a conditional branch', async () => {
    const ok = false;
    const stage = await both(
      <k-layer>
        {ok ? <k-rect name={'yes'} /> : <k-rect name={'no'} />}
      </k-layer>,
      konva`<k-layer>${
        ok
          ? konva`<k-rect name=${'yes'}></k-rect>`
          : konva`<k-rect name=${'no'}></k-rect>`
      }</k-layer>`
    );

    expect(stage.findOne('.no')).toBeTruthy();
    expect(stage.findOne('.yes')).toBeUndefined();
  });

  it('passes props to a component', async () => {
    const stage = await both(
      <k-layer>
        <Probe fill="red" size={3} />
      </k-layer>,
      konva`<k-layer><${Probe} .fill=${'red'} .size=${3} /></k-layer>`
    );

    expect(stage.findOne('Rect')?.getAttr('fill')).toBe('red');
  });

  it('passes JSX children as the children prop', async () => {
    const stage = await both(
      <k-layer>
        <Slotted>
          <k-rect name={'kid'} />
        </Slotted>
      </k-layer>,
      konva`<k-layer><${Slotted} .children=${konva`<k-rect name=${'kid'} />`} /></k-layer>`
    );

    expect(stage.findOne('.kid')?.getParent()?.name()).toBe('slotted');
  });

  it('renders the repeat directive', async () => {
    const rows = [
      { id: '1', v: 'a' },
      { id: '2', v: 'b' },
    ];

    await both(
      <k-layer>
        {repeat(
          rows,
          row => row.id,
          row => (
            <k-rect name={row.v} />
          )
        )}
      </k-layer>,
      konva`<k-layer>${repeat(
        rows,
        row => row.id,
        row => konva`<k-rect name=${row.v}></k-rect>`
      )}</k-layer>`
    );
  });

  it('renders the cache directive', async () => {
    await both(
      <k-layer>{cache(<k-rect name={'cached'} />)}</k-layer>,
      konva`<k-layer>${cache(konva`<k-rect name=${'cached'}></k-rect>`)}</k-layer>`
    );
  });

  it('renders a wrapper-less fragment as sibling layers', async () => {
    const stage = await both(
      <>
        <k-layer name={'a'} />
        <k-layer name={'b'} />
      </>,
      konva`<k-layer name=${'a'}></k-layer><k-layer name=${'b'}></k-layer>`
    );

    expect(stage.getChildren().map(layer => layer.name())).toEqual(['a', 'b']);
  });

  it('escapes a backtick in an attribute rather than ending the template', async () => {
    const stage = await both(
      <k-layer>
        <k-text text="a `b` c" />
      </k-layer>,
      konva`<k-layer><k-text text="a \`b\` c"></k-text></k-layer>`
    );

    expect(stage.findOne('Text')?.getAttr('text')).toBe('a `b` c');
  });

  it('escapes a dollar brace in a string attribute rather than interpolating', async () => {
    const stage = await both(
      <k-layer>
        <k-text text="${danger}" />
      </k-layer>,
      konva`<k-layer><k-text text="\${danger}"></k-text></k-layer>`
    );

    expect(stage.findOne('Text')?.getAttr('text')).toBe('${danger}');
  });

  it('keeps the ledger markers out of the Konva children', async () => {
    const rows = ['a', 'b'];
    const stage = await draw(
      <k-layer>
        {rows.map(row => (
          <k-rect name={row} />
        ))}
      </k-layer>
    );

    expect(stage.getChildren()).toHaveLength(1);
    expect(
      stage
        .getChildren()[0]
        .getChildren()
        .map(node => node.name())
    ).toEqual(rows);
  });
});

describe('konva binding parity', () => {
  it('routes on: to the same listener the @ sigil does', async () => {
    const jsxSpy = vi.fn();
    const taggedSpy = vi.fn();

    const jsx = await draw(
      <k-layer>
        <k-rect name={'hit'} on:click={jsxSpy} />
      </k-layer>
    );
    const tagged = await draw(
      konva`<k-layer><k-rect name=${'hit'} @click=${taggedSpy}></k-rect></k-layer>`
    );

    jsx.findOne('.hit')?.fire('click');
    tagged.findOne('.hit')?.fire('click');

    expect(jsxSpy).toHaveBeenCalledTimes(1);
    expect(taggedSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves use:ref to the same node the bare marker does', async () => {
    const jsxRef = createRef<any>();
    const taggedRef = createRef<any>();

    const jsx = await draw(
      <k-layer>
        <k-rect name={'r'} use:ref={ref(jsxRef)} />
      </k-layer>
    );
    const tagged = await draw(
      konva`<k-layer><k-rect name=${'r'} ${ref(taggedRef)}></k-rect></k-layer>`
    );

    expect(jsxRef.value).toBe(jsx.findOne('.r'));
    expect(taggedRef.value).toBe(tagged.findOne('.r'));
  });
});

describe('konva update parity', () => {
  const Counter: FC<{ step: number }> = props => () => (
    <k-group name={'counter'}>
      <k-rect width={props.step} />
    </k-group>
  );

  /**
   * One call site, so both renders share a TemplateStringsArray, the identity
   * the template cache keys on and the reason the transform emits a real tagged
   * template. Two literals would be two templates and would rebuild.
   */
  const view = (step: number) =>
    konva`<k-layer><${Counter} .step=${step} /></k-layer>`;

  it('reuses the node across a re-render instead of rebuilding it', async () => {
    const stage = mount(view(1));
    await flush();

    const before = stage.findOne('Rect');
    renderKonva(stage, view(2));
    await flush();
    const after = stage.findOne('Rect');

    expect(before).toBe(after);
    expect(after?.getAttr('width')).toBe(2);
  });

  it('does not re-mount a component whose props changed', async () => {
    const mountedSpy = vi.fn();
    const updatedSpy = vi.fn();

    const Watched: FC<{ n: number }> = props => {
      onMounted(mountedSpy);
      onUpdated(updatedSpy);
      return () => <k-rect name={'w'} width={props.n} />;
    };

    const watched = (n: number) =>
      konva`<k-layer><${Watched} .n=${n} /></k-layer>`;

    const stage = mount(watched(1));
    await flush();
    renderKonva(stage, watched(2));
    await flush();

    expect(mountedSpy).toHaveBeenCalledTimes(1);
    expect(updatedSpy.mock.calls.length).toBeGreaterThan(0);
    expect(stage.findOne('.w')?.getAttr('width')).toBe(2);
  });
});
