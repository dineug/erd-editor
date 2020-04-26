import { Store } from "./Store";
import { createCode as graphql } from "./generatorCode/graphql";
import { createCode as csharp } from "./generatorCode/csharp";
import { createCode as java } from "./generatorCode/java";
import { createCode as kotlin } from "./generatorCode/kotlin";
import { createCode as typescript } from "./generatorCode/typescript";
import { createCode as JPA } from "./generatorCode/JPA";

export function createGeneratorCode(store: Store): string {
  const language = store.canvasState.language;
  switch (language) {
    case "GraphQL":
      return graphql(store);
    case "C#":
      return csharp(store);
    case "Java":
      return java(store);
    case "Kotlin":
      return kotlin(store);
    case "TypeScript":
      return typescript(store);
    case "JPA":
      return JPA(store);
  }
  return "";
}
