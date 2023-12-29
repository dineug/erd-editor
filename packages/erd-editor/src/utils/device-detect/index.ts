import getAgent, { getAccurateAgent } from '@egjs/agent';

const agent = getAgent();

let isMacintosh = agent.os.name === 'mac';
let isIOS = agent.os.name === 'ios';
let isAndroid = agent.os.name === 'android';
let isWindows = agent.os.name === 'window';

let isChrome = agent.browser.name === 'chrome';
let isSafari = agent.browser.name === 'safari';
let isFirefox = agent.browser.name === 'firefox';

getAccurateAgent(agent => {
  isMacintosh = agent.os.name === 'mac';
  isIOS = agent.os.name === 'ios';
  isAndroid = agent.os.name === 'android';
  isWindows = agent.os.name === 'window';

  isChrome = agent.browser.name === 'chrome';
  isSafari = agent.browser.name === 'safari';
  isFirefox = agent.browser.name === 'firefox';
});

export const hasAppleDevice = () => isMacintosh || isIOS;

export const hasMacintosh = () => isMacintosh;
export const hasIOS = () => isIOS;
export const hasAndroid = () => isAndroid;
export const hasWindows = () => isWindows;

export const hasChrome = () => isChrome;
export const hasSafari = () => isSafari;
export const hasFirefox = () => isFirefox;
