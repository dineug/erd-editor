import { log } from '@/log';
import { startStdioServer } from '@/server';

startStdioServer().catch(error => {
  log('could not start', error);
  process.exitCode = 1;
});
