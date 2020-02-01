import StoreManagement from "@/store/StoreManagement";
import { Commit as TableCommit } from "@/store/table";
import graphql from "./GeneratorCode/graphql";
import cs from "./GeneratorCode/cs";
import java from "./GeneratorCode/java";
import kotlin from "./GeneratorCode/kotlin";
import typescript from "./GeneratorCode/typescript";

export const enum Language {
  graphql = "graphql",
  cs = "cs",
  java = "java",
  kotlin = "kotlin",
  typescript = "typescript"
}

export const enum Case {
  none = "none",
  camelCase = "camelCase",
  pascalCase = "pascalCase",
  snakeCase = "snakeCase"
}

class GeneratorCode {
  public toCode(store: StoreManagement): string {
    store.tableStore.commit(TableCommit.tableOrderByNameASC);
    const language = store.canvasStore.state.language;
    switch (language) {
      case Language.graphql:
        return graphql.toCode(store);
      case Language.cs:
        return cs.toCode(store);
      case Language.java:
        return java.toCode(store);
      case Language.kotlin:
        return kotlin.toCode(store);
      case Language.typescript:
        return typescript.toCode(store);
    }
    return "";
  }
}

export default new GeneratorCode();
