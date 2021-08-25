// @ts-ignore
import { Analytics } from '@dineug/vscode-google-analytics';
import macaddress from 'macaddress';

const analytics = new Analytics('UA-131336352-5');
let clientID: string | null = null;

const version = process.env.VUERD_VSCODE_VERSION || 'NONE';

export function trackEvent(action: string) {
  if (clientID === null) {
    macaddress.one().then(mac => {
      clientID = mac;
      analytics.send({
        category: `vscode-v${version}`,
        action,
        label: 'webview',
        clientID,
      });
    });
  } else {
    analytics.send({
      category: `vscode-v${version}`,
      action,
      label: 'webview',
      clientID,
    });
  }
}
