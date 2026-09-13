/** @jsxHost konva */

import { createRef, FC, observer, onMounted, ref } from '@dineug/r-html';
import type { Layer } from 'konva/lib/Layer';

import { useAppContext } from '@/components/appContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getSceneOrigin, getSceneTransform } from '@/konva/scene/viewport';

import { getParticleEdges } from './particleEdges';
import { createParticleLoop } from './particleLoop';

export type ParticleLayerProps = {};

/**
 * The layer the particles of a view's lit connectors run on, under the scene,
 * since a card hides the connectors behind it and a particle riding one goes
 * with them. Its one empty layer is committed at mount and drawn by the loop alone.
 */
const ParticleLayer: FC<ParticleLayerProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const sourceRef = useSceneSource(ctx);
  const layerRef = createRef<Layer>();
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const layer = layerRef.value;
    if (!layer) return;

    const loop = createParticleLoop(layer);

    // The lit set, the routes under it and the palette are tracked here and
    // not in the render, so a hover moves circles and rewrites no template.
    addUnsubscribe(
      loop.stop,
      observer(() => {
        loop.setEdges(
          getParticleEdges(app.value.store.state, sourceRef.value),
          themeRef.value.accentColor9
        );
      }),
      observer(() => {
        const transform = getSceneTransform(
          app.value.store.state,
          sourceRef.value
        );
        loop.setPlacement(getSceneOrigin(transform), transform.zoomLevel);
      })
    );
  });

  // Keep this layer childless. The host's ledger owns the membership of every
  // konva parent a template writes, and a reconcile of this layer would drop
  // every circle the loop added, as children it never booked, in silence.
  return () => (
    <k-layer name="view-particles" listening={false} use:ref={ref(layerRef)} />
  );
};

export default ParticleLayer;
