import * as Comlink from 'comlink';

import type { ShikiService as ShikiServiceType } from '@/workers/shiki.worker';
import ShikiWorker from '@/workers/shiki.worker?worker&inline';

class ShikiService {
  private static instance: ShikiService;

  private worker: Comlink.Remote<ShikiServiceType>;
  private constructor() {
    this.worker = Comlink.wrap<ShikiServiceType>(new ShikiWorker());
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
    return await this.worker.codeToHtml(code, { lang, theme });
  }
}

export { ShikiService };
