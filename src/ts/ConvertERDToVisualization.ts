import StoreManagement from "@/store/StoreManagement";

export type Group = "Cited Works" | "Citing Patents";

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
        group: "Cited Works"
      });
      table.columns.forEach(column => {
        data.nodes.push({
          id: column.id,
          name: column.name,
          group: "Citing Patents"
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
}

export default new ConvertERDToVisualization();
