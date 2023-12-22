// @ts-ignore
import hljs from 'highlight.js/lib/core.js';
// @ts-ignore
import csharp from 'highlight.js/lib/languages/csharp.js';
// @ts-ignore
import go from 'highlight.js/lib/languages/go.js';
// @ts-ignore
import java from 'highlight.js/lib/languages/java.js';
// @ts-ignore
import javascript from 'highlight.js/lib/languages/javascript.js';
// @ts-ignore
import kotlin from 'highlight.js/lib/languages/kotlin.js';
// @ts-ignore
import rust from 'highlight.js/lib/languages/rust.js';
// @ts-ignore
import scala from 'highlight.js/lib/languages/scala.js';
// @ts-ignore
import sql from 'highlight.js/lib/languages/sql.js';
// @ts-ignore
import swift from 'highlight.js/lib/languages/swift.js';
// @ts-ignore
import typescript from 'highlight.js/lib/languages/typescript.js';
// @ts-ignore
import xml from 'highlight.js/lib/languages/xml.js';
// @ts-ignore
import graphql from 'highlightjs-graphql';

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('swift', swift);
graphql(hljs);

export { hljs };
