import { createRef, FC, html, observable, ref, repeat } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import { useFlipAnimation } from '@/hooks/useFlipAnimation';
import { FlipAnimation } from '@/utils/flipAnimation';

const state = observable<{ items: string[] }>({ items: [] });
const ORIGINAL_PLAY = FlipAnimation.prototype.play;

const Probe: FC<{}> = () => {
  const root = createRef<HTMLElement>();
  useFlipAnimation(root, '.item', 'flip-move');

  return () => html`
    <div class="root" ${ref(root)}>
      ${repeat(
        state.items,
        item => item,
        item => html`<div class="item">${item}</div>`
      )}
    </div>
  `;
};

let mounted: Mounted | null = null;
let snapshotSpy: ReturnType<typeof vi.spyOn>;
let playSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  state.items = ['a', 'b'];
  snapshotSpy = vi.spyOn(FlipAnimation.prototype, 'snapshot');
  playSpy = vi.spyOn(FlipAnimation.prototype, 'play');
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

describe('useFlipAnimation', () => {
  it('does not snapshot or play on the first render', async () => {
    mounted = await mountAndFlush(html`<${Probe} />`);

    expect(mounted.container.querySelectorAll('.item')).toHaveLength(2);
    expect(snapshotSpy).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('snapshots before an update and plays after it', async () => {
    mounted = await mountAndFlush(html`<${Probe} />`);

    state.items = ['b', 'a', 'c'];
    await flush();

    expect(mounted.container.querySelectorAll('.item')).toHaveLength(3);
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(snapshotSpy.mock.invocationCallOrder[0]).toBeLessThan(
      playSpy.mock.invocationCallOrder[0]
    );
  });

  it('runs the pair once per update', async () => {
    mounted = await mountAndFlush(html`<${Probe} />`);

    state.items = ['b', 'a'];
    await flush();
    state.items = ['a', 'b'];
    await flush();

    expect(snapshotSpy).toHaveBeenCalledTimes(2);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it('drives a FlipAnimation built from the given ref, selector and class', async () => {
    mounted = await mountAndFlush(html`<${Probe} />`);

    state.items = ['b', 'a'];
    await flush();

    const instance = snapshotSpy.mock.instances[0] as any;
    expect(instance).toBeInstanceOf(FlipAnimation);
    expect(instance.selector).toBe('.item');
    expect(instance.animationName).toBe('flip-move');
    expect(instance.root.value).toBe(mounted.container.querySelector('.root'));
  });

  it('inverts the moved elements with a transform when their box changed', async () => {
    let top = 100;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ top, left: 0 }) as DOMRect
    );
    playSpy.mockImplementation(function (this: FlipAnimation) {
      top = 0;
      return ORIGINAL_PLAY.call(this);
    });

    mounted = await mountAndFlush(html`<${Probe} />`);

    state.items = ['b', 'a'];
    await flush();

    const items = Array.from(
      mounted.container.querySelectorAll<HTMLElement>('.item')
    );
    expect(items).toHaveLength(2);
    items.forEach(item => {
      expect(item.style.transform).toBe('translate(0px,100px)');
      expect(item.style.transitionDuration).toBe('0s');
    });
  });

  it('stops snapshotting once the component is unmounted', async () => {
    mounted = await mountAndFlush(html`<${Probe} />`);
    mounted.unmount();
    mounted = null;

    state.items = ['x', 'y', 'z'];
    await flush();

    expect(snapshotSpy).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });
});
