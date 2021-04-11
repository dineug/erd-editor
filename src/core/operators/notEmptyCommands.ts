import { CommandTypeAll } from '@@types/engine/command';
import { filter } from 'rxjs/operators';

export const notEmptyCommands = filter<CommandTypeAll[]>(
  commands => !!commands.length
);
