import { svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { Subscription } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { createRelationship } from "./Relationship";
import { Logger } from "@src/core/Logger";
import { Relationship } from "@src/core/store/Relationship";
import { activeColumn, activeEndColumn } from "@src/core/command/column";

@customElement("vuerd-canvas-svg")
class CanvasSVG extends EditorElement {
  @property({ type: String })
  activeId = "";

  private relationships: Relationship[] = [];
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
      }),
      store.observe(store.canvasState.show, () => {
        this.requestUpdate();
      })
    );
    this.observeRelationships();
  }
  disconnectedCallback() {
    this.unsubscribeRelationships();
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
        (relationship) => {
          const shape = createRelationship(relationship);
          return svg`
            <g
              class=${classMap({
                "vuerd-relationship": true,
                identification:
                  relationship.identification &&
                  this.activeId !== relationship.id,
                active: this.activeId === relationship.id,
              })}
              data-id=${relationship.id}
              @mouseover=${() => this.onMouseover(relationship)}
              @mouseleave=${() => this.onMouseleave(relationship)}
            >
              ${shape}
            </g>
          `;
        }
      )}
      </svg>
    `;
  }

  private onMouseover(relationship: Relationship) {
    const { store } = this.context;
    store.dispatch(activeColumn(relationship));
    this.activeId = relationship.id;
  }
  private onMouseleave(relationship: Relationship) {
    const { store } = this.context;
    store.dispatch(activeEndColumn(relationship));
    this.activeId = "";
  }

  private observeRelationships() {
    const { store } = this.context;
    this.relationships.forEach((relationship) => {
      this.subRelationships.push(
        store.observe(relationship, () => this.requestUpdate()),
        store.observe(relationship.start, () => this.requestUpdate()),
        store.observe(relationship.end, () => this.requestUpdate())
      );
    });
  }
  private unsubscribeRelationships() {
    this.subRelationships.forEach((sub) => sub.unsubscribe());
    this.subRelationships = [];
  }
}
