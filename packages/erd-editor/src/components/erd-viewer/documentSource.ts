import { observable } from '@dineug/r-html';

import type { ViewStatus } from '@/components/erd-view/ErdView';

export type DocumentSourceOptions = {
  /** Takes the text a response carried in, throwing when it holds no document. */
  apply: (text: string) => void;
  /** After apply took a fetched document in. */
  onLoad: () => void;
  /** After a fetch, its response or apply failed, with what failed. */
  onError: (cause: unknown) => void;
};

export type DocumentSource = {
  /** What the latest fetch is doing: loading, failed, or idle once it landed or was cancelled. */
  state: { status: ViewStatus };
  /** Fetches the url, cancelling a fetch still running, and resolves once the fetch is done with. */
  load: (url: string) => Promise<void>;
  /** Aborts a fetch still running, which then calls nothing back, and clears a failure reported. */
  cancel: () => void;
};

/**
 * The viewer's src: a GET of a document in the form a file saves, which the
 * browser's CORS rules govern. The fetch started last wins, each earlier one
 * aborted, so a slow response never lands over a later document.
 */
export function createDocumentSource({
  apply,
  onLoad,
  onError,
}: DocumentSourceOptions): DocumentSource {
  const state = observable<{ status: ViewStatus }>({ status: 'idle' });
  let controller: AbortController | null = null;

  const cancel = () => {
    controller?.abort();
    controller = null;
    state.status = 'idle';
  };

  const load = async (url: string) => {
    cancel();
    const current = new AbortController();
    controller = current;
    state.status = 'loading';

    try {
      const response = await fetch(url, { signal: current.signal });
      if (!response.ok) {
        throw new Error(
          `GET ${url} answered ${response.status} ${response.statusText}`.trim()
        );
      }
      const text = await response.text();
      if (controller !== current) return;

      apply(text);
      controller = null;
      state.status = 'idle';
      onLoad();
    } catch (error) {
      if (controller !== current) return;

      controller = null;
      state.status = 'error';
      onError(error);
    }
  };

  return { state, load, cancel };
}
