import 'virtual:windi.css';
import 'virtual:windi-devtools';
import '@/config';

// @ts-ignore
import { registerSW } from 'virtual:pwa-register';
import { createApp } from 'vue';

import App from './App.vue';

const updateSW = registerSW({
  onOfflineReady() {},
});

createApp(App).mount('#app');
