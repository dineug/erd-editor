// @ts-ignore
import hljs from 'highlight.js/lib/core.js';
// @ts-ignore
import sql from 'highlight.js/lib/languages/sql.js';
// @ts-ignore
import csharp from 'highlight.js/lib/languages/csharp.js';
// @ts-ignore
import java from 'highlight.js/lib/languages/java.js';
// @ts-ignore
import kotlin from 'highlight.js/lib/languages/kotlin.js';
// @ts-ignore
import typescript from 'highlight.js/lib/languages/typescript.js';
// @ts-ignore
import scala from 'highlight.js/lib/languages/scala.js';
// @ts-ignore
import graphql from 'highlightjs-graphql';

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('scala', scala);
graphql(hljs);

export { hljs };
