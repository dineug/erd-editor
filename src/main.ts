import Vue from 'vue';
import App from './App.vue';
import VuerdCore from 'vuerd-core';
import ERD, {Vuerd} from './components';
import 'vuerd-core/dist/vuerd-core.css';

Vue.config.productionTip = false;
VuerdCore.use(ERD);
Vue.use(VuerdCore);
Vue.component('Vuerd', Vuerd);

new Vue({
  render: (h) => h(App),
}).$mount('#app');
