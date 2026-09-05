import './webview.css';
import 'core-js/stable';

import { mountWebview } from '@dineug/erd-editor-webview-client';

mountWebview({
  dispatch: action => {
    window.cefQuery({
      request: JSON.stringify(action),
      persistent: false,
      onSuccess: () => {},
      onFailure: () => {},
    });
  },
  workerName: '@dineug/erd-editor-intellij-webview/replication-store-worker',
});
