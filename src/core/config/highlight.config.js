import hljs from 'highlight.js/lib/core.js';
import sql from 'highlight.js/lib/languages/sql.js';
import csharp from 'highlight.js/lib/languages/csharp.js';
import java from 'highlight.js/lib/languages/java.js';
import kotlin from 'highlight.js/lib/languages/kotlin.js';
import typescript from 'highlight.js/lib/languages/typescript.js';
import scala from 'highlight.js/lib/languages/scala.js';
import graphql from 'highlightjs-graphql';

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('scala', scala);
graphql(hljs);

export { hljs };
