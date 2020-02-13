import StoreManagement from "@/store/StoreManagement";
import { Column } from "@/store/table";

export type Group = "table" | "column" | "pk" | "fk" | "pfk";

export interface Node {
  id: string;
  group: Group;
  name: string;
}

export interface Link {
  source: string;
  target: string;
}

export interface Visualization {
  nodes: Node[];
  links: Link[];
}

class ConvertERDToVisualization {
  public toVisualization(store: StoreManagement): Visualization {
    const data: Visualization = {
      nodes: [],
      links: []
    };
    const tables = store.tableStore.state.tables;
    const relationships = store.relationshipStore.state.relationships;

    tables.forEach(table => {
      data.nodes.push({
        id: table.id,
        name: table.name,
        group: "table"
      });
      table.columns.forEach(column => {
        data.nodes.push({
          id: column.id,
          name: column.name,
          group: this.getGroup(column)
        });
        data.links.push({
          source: table.id,
          target: column.id
        });
      });
    });

    relationships.forEach(relationship => {
      data.links.push({
        source: relationship.start.tableId,
        target: relationship.end.tableId
      });
    });

    return data;
  }

  private getGroup(column: Column): Group {
    if (column.ui.pk) {
      return "pk";
    } else if (column.ui.fk) {
      return "fk";
    } else if (column.ui.pfk) {
      return "pfk";
    }
    return "column";
  }
}

export default new ConvertERDToVisualization();
