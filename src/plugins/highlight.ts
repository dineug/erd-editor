import "highlight.js/styles/monokai-sublime.css";
// @ts-ignore
import hljs from "highlight.js/lib/highlight";
// @ts-ignore
import sql from "highlight.js/lib/languages/sql.js";
// @ts-ignore
import cs from "highlight.js/lib/languages/cs.js";
// @ts-ignore
import java from "highlight.js/lib/languages/java.js";
// @ts-ignore
import kotlin from "highlight.js/lib/languages/kotlin.js";
// @ts-ignore
import typescript from "highlight.js/lib/languages/typescript.js";
// @ts-ignore
import graphql from "highlightjs-graphql";

hljs.registerLanguage("sql", sql);
hljs.registerLanguage("cs", cs);
hljs.registerLanguage("java", java);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("typescript", typescript);
graphql(hljs);

export default hljs;
