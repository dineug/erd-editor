import fs from "fs";
import path from "path";
import { tokenizer, parser } from "@src/core/SQLParser";

it("lexer", (done) => {
  const ddl = fs.readFileSync(
    path.join(__dirname, "../../../data/test.sql"),
    "utf8"
  );
  const tokens = tokenizer(ddl);
  console.log(tokens);
  console.log(parser(tokens));
  done();
});
