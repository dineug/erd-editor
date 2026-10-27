// toImage from the package root defines no tag and carries the export worker alone.
import { toImage } from '@dineug/erd-editor';

globalThis.__consumerProbe = typeof toImage;
