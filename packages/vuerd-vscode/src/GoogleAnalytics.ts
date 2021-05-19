// @ts-ignore
import { Analytics } from "@dineug/vscode-google-analytics";
import macaddress from "macaddress";

const analytics = new Analytics("UA-131336352-5");
let clientID: string | null = null;

export function trackEvent(action: string) {
  if (clientID === null) {
    macaddress.one().then((mac) => {
      clientID = mac;
      analytics.send({
        category: "vscode",
        action,
        label: "webview",
        clientID,
      });
    });
  } else {
    analytics.send({
      category: "vscode",
      action,
      label: "webview",
      clientID,
    });
  }
}
