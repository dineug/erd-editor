import {uuid} from '@/ts/util';
import {Relationship, Point, RelationshipType} from '@/store/relationship';
import StoreManagement from '@/store/StoreManagement';

export default class RelationshipModel implements Relationship {
  public id: string;
  public identification: boolean;
  public relationshipType: RelationshipType;
  public start: Point | null = null;
  public end: Point | null = null;
  private store: StoreManagement;

  constructor(store: StoreManagement, relationshipType: RelationshipType) {
    this.store = store;
    this.id = uuid();
    this.identification = false;
    this.relationshipType = relationshipType;
  }

}
