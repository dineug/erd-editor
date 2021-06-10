import { filter } from 'rxjs/operators';

import { CommandTypeAll } from '@@types/engine/command';

export const notEmptyCommands = filter<CommandTypeAll[]>(
  commands => !!commands.length
);
