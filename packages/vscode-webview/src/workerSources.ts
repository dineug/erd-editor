const blobs = new Map<string, string>();
const reads = new Map<string, Promise<void>>();

/**
 * Starts the read of one worker script and gives back the url it is keyed by.
 * Called where the url is imported rather than where the worker is built, so
 * every read is in flight from the moment the editor's module is evaluated.
 */
export function registerWorkerSource(url: string): string {
  if (!reads.has(url)) {
    reads.set(
      url,
      fetch(url)
        .then(response => response.text())
        .then(source => {
          blobs.set(
            url,
            URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
          );
        })
        .catch(error => {
          console.warn(`[workers] ${url} could not be read`, error);
        })
    );
  }

  return url;
}

/** Settles once every registered script has been read, or has failed to be. */
export function whenWorkerSourcesReady(): Promise<void> {
  return Promise.all(reads.values()).then(() => undefined);
}

/**
 * The same-origin url a worker is built from. A script that could not be read
 * throws here, which is the signal the editor's services already take as this
 * host building no worker, and each of them falls back on its own.
 */
export function workerBlobUrl(url: string): string {
  const blob = blobs.get(url);
  if (!blob) throw new Error(`[workers] ${url} was not read`);

  return blob;
}
