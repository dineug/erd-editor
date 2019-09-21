import Vue from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faKey,
  faTable,
  faStickyNote,
  faPlus,
  faTimes,
  faChevronRight,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

library.add(
  faKey,
  faTable,
  faStickyNote,
  faPlus,
  faTimes,
  faChevronRight,
  faCheck,
);

Vue.component('font-awesome-icon', FontAwesomeIcon);
