import Vue from "vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
  faKey,
  faTable,
  faStickyNote,
  faPlus,
  faTimes,
  faChevronRight,
  faCheck,
  faCode,
  faList,
  faBezierCurve,
  faRedoAlt,
  faUndoAlt,
  faSearch,
  faQuestion
} from "@fortawesome/free-solid-svg-icons";

library.add(
  faKey,
  faTable,
  faStickyNote,
  faPlus,
  faTimes,
  faChevronRight,
  faCheck,
  faCode,
  faList,
  faBezierCurve,
  faRedoAlt,
  faUndoAlt,
  faSearch,
  faQuestion
);

Vue.component("font-awesome-icon", FontAwesomeIcon);
