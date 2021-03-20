import './SQLDDL';

import { Panel, PanelProps, ERDEditorContext } from '@@types/index';

export class SQLDDLPanel implements Panel {
  el = document.createElement('vuerd-sql-ddl');
  props: PanelProps;

  constructor(props: PanelProps, api: ERDEditorContext) {
    this.props = props;
    this.el.api = api;
  }

  render() {
    return this.el;
  }
}
