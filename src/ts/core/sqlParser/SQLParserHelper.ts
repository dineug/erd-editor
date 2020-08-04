import { MySQLKeywords } from "./keyword/MySQL";
import { PostgreSQLKeywords } from "./keyword/PostgreSQL";

export function getKeywords(): string[] {
  const keywords: string[] = [...MySQLKeywords];

  PostgreSQLKeywords.forEach((keyword) => {
    if (!keywords.some((k) => k.toUpperCase() === keyword.toUpperCase())) {
      keywords.push(keyword);
    }
  });

  return keywords;
}
