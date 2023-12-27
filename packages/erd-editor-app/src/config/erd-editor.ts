import { setGetShikiServiceCallback } from '@dineug/erd-editor';
import { getShikiService } from '@dineug/erd-editor-shiki-worker';

setGetShikiServiceCallback(getShikiService);
