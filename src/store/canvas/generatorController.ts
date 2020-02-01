import { State } from "../canvas";
import { Language, Case } from "@/ts/GeneratorCode";
import { log } from "@/ts/util";

export function generatorLanguageChange(state: State, language: Language) {
  log.debug("generatorCodeController generatorLanguageChange");
  state.language = language;
}

export function generatorTableCaseChange(state: State, tableCase: Case) {
  log.debug("generatorCodeController generatorTableCaseChange");
  state.tableCase = tableCase;
}

export function generatorColumnCaseChange(state: State, columnCase: Case) {
  log.debug("generatorCodeController generatorColumnCaseChange");
  state.columnCase = columnCase;
}
