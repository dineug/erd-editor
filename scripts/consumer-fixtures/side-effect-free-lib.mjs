// webview-client's shape: a library marked side-effect free in between, whose
// module imports the editor's entry for its effect alone.
import { mounted } from 'side-effect-free-lib';

globalThis.__consumerProbe = mounted;
