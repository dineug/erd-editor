import './components/SQLDDL';

import {
  Panel,
  PanelConfig,
  PanelProps,
  ERDEditorContext,
} from '@@types/index';

class SQLDDLPanel implements Panel {
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

export const SQLDDLPanelConfig: PanelConfig = {
  type: SQLDDLPanel,
  icon: {
    prefix: 'mdi',
    name: 'database-export',
    size: 20,
  },
  key: 'SQL',
  name: 'SQL DDL',
};
