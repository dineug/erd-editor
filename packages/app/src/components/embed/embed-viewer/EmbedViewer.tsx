import '@dineug/erd-editor/erd-viewer.js';

import type { ErdViewerElement } from '@dineug/erd-editor';
import { useLayoutEffect, useRef } from 'react';

import {
  applyEmbedOptions,
  applyPreviewOptions,
  EMBED_DEFAULTS,
  type EmbedDisplayOptions,
  type EmbedOptions,
} from '@/utils/embedOptions';
import { toGithubRawUrl } from '@/utils/githubRawUrl';

import * as styles from './EmbedViewer.styles';

/** The builder's preview: the system language the page's lang would otherwise stand for. */
export type EmbedPreview = { systemLocale: string };

interface EmbedViewerProps {
  options: EmbedOptions;
  preview?: EmbedPreview;
}

type Handed = { options: EmbedOptions; systemLocale: string };

const DISPLAY_KEYS = Object.keys(EMBED_DEFAULTS) as Array<
  keyof EmbedDisplayOptions
>;

function sameDisplay(a: EmbedDisplayOptions, b: EmbedDisplayOptions) {
  return DISPLAY_KEYS.every(key => a[key] === b[key]);
}

/** Puts the viewer in the scope, and as the effect ends takes it out, then destroys it. */
function attach($scope: HTMLElement, viewer: ErdViewerElement) {
  $scope.appendChild(viewer);
  return () => {
    $scope.removeChild(viewer);
    viewer.destroy();
  };
}

const PageViewer: React.FC<{ options: EmbedOptions }> = ({ options }) => {
  const scopeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const $scope = scopeRef.current;
    if (!$scope) return;

    const viewer = document.createElement('erd-viewer');
    applyEmbedOptions(viewer, options);
    viewer.src = toGithubRawUrl(options.src);
    return attach($scope, viewer);
  }, [options]);

  return <div css={styles.scope} ref={scopeRef} />;
};

/**
 * One viewer for the builder's whole visit: every option and the system language
 * before it attaches, then each change, and its src apart, where none empties
 * the canvas, which a src emptied alone would leave drawn.
 */
const PreviewViewer: React.FC<{
  options: EmbedOptions;
  systemLocale: string;
}> = ({ options, systemLocale }) => {
  const scopeRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ErdViewerElement | null>(null);
  const handedRef = useRef<Handed>({ options, systemLocale });

  useLayoutEffect(() => {
    const $scope = scopeRef.current;
    if (!$scope) return;

    const viewer = document.createElement('erd-viewer');
    const handed = handedRef.current;
    applyPreviewOptions(viewer, handed.options, handed.systemLocale);
    if (handed.options.src) viewer.src = toGithubRawUrl(handed.options.src);
    viewerRef.current = viewer;

    const detach = attach($scope, viewer);
    return () => {
      viewerRef.current = null;
      detach();
    };
  }, []);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    const handed = handedRef.current;
    if (
      !viewer ||
      (sameDisplay(handed.options, options) &&
        handed.systemLocale === systemLocale)
    ) {
      return;
    }

    applyPreviewOptions(viewer, options, systemLocale);
    handedRef.current = {
      options: { ...options, src: handed.options.src },
      systemLocale,
    };
  }, [options, systemLocale]);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    const handed = handedRef.current;
    if (!viewer || handed.options.src === options.src) return;

    if (options.src) {
      viewer.src = toGithubRawUrl(options.src);
    } else {
      viewer.src = '';
      viewer.value = '';
    }
    handedRef.current = {
      ...handed,
      options: { ...handed.options, src: options.src },
    };
  }, [options.src]);

  return <div css={styles.scope} ref={scopeRef} />;
};

/**
 * Creates the viewer with every option and its src set before it joins the
 * page, so its first fetch and first draw take them; the builder's preview
 * keeps one viewer and hands it each change. No listener reports its error.
 */
const EmbedViewer: React.FC<EmbedViewerProps> = ({ options, preview }) =>
  preview ? (
    <PreviewViewer options={options} systemLocale={preview.systemLocale} />
  ) : (
    <PageViewer options={options} />
  );

export default EmbedViewer;
