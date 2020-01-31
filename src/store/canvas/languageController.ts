import { State } from "../canvas";
import { Language } from "@/ts/GeneratorCode";
import { log } from "@/ts/util";

export function languageChange(state: State, language: Language) {
  log.debug("languageController languageChange");
  state.language = language;
}
