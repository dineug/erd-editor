import {uuid} from '@/ts/util';
import {columnIds, createColumns, createPrimaryKey} from '@/store/relationship/relationshipHelper';
import {Relationship, PointDrawStart, Point, RelationshipType, Direction} from '@/store/relationship';
import {Table} from '@/store/table';
import StoreManagement from '@/store/StoreManagement';

export default class RelationshipModel implements Relationship {
  public id: string;
  public identification: boolean = false;
  public relationshipType: RelationshipType;
  public start: Point;
  public end: Point;

  constructor(store: StoreManagement, relationshipType: RelationshipType, start: PointDrawStart, table: Table) {
    createPrimaryKey(store, start.table);
    this.id = uuid();
    this.relationshipType = relationshipType;
    this.start = {
      tableId: start.table.id,
      columnIds: columnIds(start.table),
      x: start.x,
      y: start.y,
      direction: Direction.bottom,
    };
    this.end = {
      tableId: table.id,
      columnIds: createColumns(store, start.table, table),
      x: table.ui.left,
      y: table.ui.top,
      direction: Direction.bottom,
    };
  }
}
