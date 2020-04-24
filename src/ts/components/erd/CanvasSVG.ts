import { svg, customElement } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { Relationship } from "@src/core/store/Relationship";
import { createRelationship } from "./Relationship";

@customElement("vuerd-canvas-svg")
class CanvasSVG extends EditorElement {
  private relationships: Relationship[] = [];
  private subscriptionList: Subscription[] = [];
  private subRelationships: Subscription[] = [];

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    this.relationships = store.relationshipState.relationships;
    this.subscriptionList.push(
      store.observe(this.relationships, () => {
        this.unsubscribeRelationships();
        this.observeRelationships();
        this.requestUpdate();
      }),
      store.observe(store.canvasState, (name) => {
        switch (name) {
          case "width":
          case "height":
            this.requestUpdate();
            break;
        }
      })
    );
    this.observeRelationships();
  }
  disconnectedCallback() {
    this.unsubscribeRelationships();
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { width, height } = this.context.store.canvasState;
    return svg`
      <svg 
        class="vuerd-canvas-svg"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
        })}
      >
      ${repeat(
        this.relationships,
        (relationship) => relationship.id,
        (relationship) => createRelationship(relationship)
      )}
      </svg>
    `;
  }

  observeRelationships() {
    const { store } = this.context;
    this.relationships.forEach((relationship) => {
      this.subRelationships.push(
        store.observe(relationship, () => this.requestUpdate()),
        store.observe(relationship.start, () => this.requestUpdate()),
        store.observe(relationship.end, () => this.requestUpdate())
      );
    });
  }
  unsubscribeRelationships() {
    this.subRelationships.forEach((sub) => sub.unsubscribe());
    this.subRelationships = [];
  }
}
