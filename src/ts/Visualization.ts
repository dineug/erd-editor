// https://observablehq.com/@d3/disjoint-force-directed-graph

import {
  scaleOrdinal,
  schemeCategory10,
  event,
  drag as d3drag,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  create
} from "d3";
import { Visualization } from "./ConvertERDToVisualization";
import StoreManagement from "@/store/StoreManagement";
import { Bus } from "@/ts/EventBus";
import { Table } from "@/store/table";
import { getData } from "./util";

const scale = scaleOrdinal(schemeCategory10);

function drag(simulation: any, store: StoreManagement): any {
  function dragstarted(d: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
    store.eventBus.$emit(Bus.Visualization.dragStart);
  }

  function dragged(d: any) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(d: any) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
    store.eventBus.$emit(Bus.Visualization.dragEnd);
  }

  return d3drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

function chart(data: Visualization, store: StoreManagement) {
  const links = data.links.map(d => Object.create(d));
  const nodes = data.nodes.map(d => Object.create(d));

  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink(links).id((d: any) => d.id)
    )
    .force("charge", forceManyBody())
    .force("x", forceX())
    .force("y", forceY());

  const svg = create("svg");

  const link = svg
    .append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", Math.sqrt(2));

  const node = svg
    .append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", 5)
    .attr("fill", d => scale(d.group))
    .call(drag(simulation, store));

  node.on("mouseover", d => {
    const node = data.nodes[d.index];
    let table: Table | null = null;
    let columnId: string = "";
    if (node.group === "table") {
      table = getData(store.tableStore.state.tables, node.id);
    } else if (node.group === "column" && node.tableId) {
      table = getData(store.tableStore.state.tables, node.tableId);
      columnId = node.id;
    }
    store.eventBus.$emit(Bus.Visualization.previewStart, {
      table,
      columnId
    });
  });
  node.on("mouseleave", () => {
    store.eventBus.$emit(Bus.Visualization.previewEnd);
  });

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("cx", d => d.x).attr("cy", d => d.y);
  });

  return svg;
}

export { chart };
