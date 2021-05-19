import { Panel } from '@@types/index';

export class SQLDDLPanel implements Panel {
  el = document.createElement('vuerd-sql-ddl');

  render() {
    return this.el;
  }
}
