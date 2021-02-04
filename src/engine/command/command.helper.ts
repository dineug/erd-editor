import { CommandKey, CommandType } from '@@types/engine/command';

export const createCommand = <K extends CommandKey>(
  name: K,
  data: CommandType<K>['data']
) => ({
  name,
  data,
});
