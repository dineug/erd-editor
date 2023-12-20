import * as Comlink from 'comlink';

import ShikiSharedWorker from '@/workers/shiki.shared-worker?sharedworker&inline';

// import ShikiWorker from '@/workers/shiki.worker?worker&inline';
import type { ShikiService as ShikiServiceType } from './shikiService';

const WORKER_NAME = `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}`;

class ShikiService {
  private static instance: ShikiService;

  private remoteService: Comlink.Remote<ShikiServiceType>;
  private constructor() {
    try {
      const worker = new ShikiSharedWorker({
        name: WORKER_NAME,
      });
      this.remoteService = Comlink.wrap<ShikiServiceType>(worker.port);
    } catch (error) {
      console.error(error);
      // TODO: fallback
      // const worker = new ShikiWorker({
      //   name: WORKER_NAME,
      // });
      // this.remoteService = Comlink.wrap<ShikiServiceType>(worker);
    }
  }

  static getInstance() {
    if (!ShikiService.instance) {
      ShikiService.instance = new ShikiService();
    }

    return ShikiService.instance;
  }

  async codeToHtml(
    ...args: Parameters<InstanceType<typeof ShikiServiceType>['codeToHtml']>
  ) {
    const [code, { lang, theme }] = args;
    return await this.remoteService.codeToHtml(code, { lang, theme });
  }
}

export { ShikiService };
