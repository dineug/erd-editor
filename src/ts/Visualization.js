/**
 * https://observablehq.com/@d3/disjoint-force-directed-graph
 */
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

const scale = scaleOrdinal(schemeCategory10);

const drag = simulation => {
  function dragstarted(d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
};

const chart = data => {
  const links = data.links.map(d => Object.create(d));
  const nodes = data.nodes.map(d => Object.create(d));

  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink(links).id(d => d.id)
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
    .attr("stroke-width", d => Math.sqrt(2));

  const node = svg
    .append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", 5)
    .attr("fill", d => scale(d.group))
    .call(drag(simulation));

  node.append("title").text(d => d.name);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("cx", d => d.x).attr("cy", d => d.y);
  });

  return svg;
};

export { chart };
