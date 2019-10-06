import StoreManagement from '@/store/StoreManagement';
import {Table, Column} from '@/store/table';
import {Relationship} from '@/store/relationship';
import {formatNames, formatSize, formatSpace} from '../SQLHelper';

class MariaDB {
  private fkNames: string[] = [];

  public toDDL(store: StoreManagement): string {
    this.fkNames = [];
    const stringBuffer = [];
    const tables = store.tableStore.state.tables;
    const relationships = store.relationshipStore.state.relationships;
    const canvas = store.canvasStore.state;

    stringBuffer.push(`DROP DATABASE IF EXISTS ${canvas.databaseName};`);
    stringBuffer.push('');
    stringBuffer.push(`CREATE DATABASE ${canvas.databaseName};`);
    stringBuffer.push(`USE ${canvas.databaseName}`);
    stringBuffer.push('');


    return '';
  }
}

export default new MariaDB();
