import {uuid} from '@/ts/util';
import {RelationshipDraw, PointDrawEnd, PointDrawStart, RelationshipType} from '@/store/relationship';

export default class RelationshipDrawModal implements RelationshipDraw {
  public id: string;
  public relationshipType: RelationshipType;
  public start: PointDrawStart | null = null;
  public end: PointDrawEnd;

  constructor(relationshipType: RelationshipType) {
    this.id = uuid();
    this.relationshipType = relationshipType;
    this.end = {
      x: 0,
      y: 0,
    };
  }

}
