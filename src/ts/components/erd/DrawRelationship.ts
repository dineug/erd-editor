import { svg, customElement, property } from "lit-element";
import { styleMap } from "lit-html/directives/style-map";
import { Subscription, fromEvent } from "rxjs";
import { EditorElement } from "@src/components/EditorElement";
import { Logger } from "@src/core/Logger";
import { getDraw } from "@src/core/helper/RelationshipHelper";
import { DrawRelationship as DrawRelationshipModel } from "@src/core/store/Editor";
import { drawRelationship } from "@src/core/command/editor";

@customElement("vuerd-draw-relationship")
class DrawRelationship extends EditorElement {
  draw!: DrawRelationshipModel;

  private subscriptionList: Subscription[] = [];
  private subDrawRelationship: Subscription | null = null;

  connectedCallback() {
    super.connectedCallback();
    const { store } = this.context;
    const root = this.getRootNode() as ShadowRoot;
    const erd = root.querySelector(".vuerd-erd") as Element;
    this.subscriptionList.push(
      fromEvent<MouseEvent>(erd, "mousemove").subscribe(this.onMousemoveERD),
      store.observe(store.canvasState, (name) => {
        switch (name) {
          case "width":
          case "height":
            this.requestUpdate();
            break;
        }
      }),
      store.observe(store.editorState, (name) => {
        const { drawRelationship } = store.editorState;
        if (name === "drawRelationship") {
          this.unsubscribeDrawRelationship();
          if (drawRelationship !== null) {
            this.observeDrawRelationship();
          }
        }
      })
    );
    this.observeDrawRelationship();
  }
  disconnectedCallback() {
    this.unsubscribeDrawRelationship();
    this.subscriptionList.forEach((sub) => sub.unsubscribe());
    super.disconnectedCallback();
  }

  render() {
    const { width, height } = this.context.store.canvasState;
    const { path, line } = getDraw(this.draw);
    return svg`
      <svg
        class="vuerd-draw-relationship"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
        })}
      >
        <g>
          <line
            x1=${path.line.start.x1} y1=${path.line.start.y1}
            x2=${path.line.start.x2} y2=${path.line.start.y2}
            stroke-width="3"
          ></line>
          <path
            d=${path.path.d()}
            stroke-dasharray="10"
            stroke-width="3" fill="transparent"
          ></path>
          <line
            x1=${line.start.x1} y1=${line.start.y1}
            x2=${line.start.x2} y2=${line.start.y2}
            stroke-width="3"
          ></line>
        </g>
      </svg>
    `;
  }

  private onMousemoveERD = (event: MouseEvent) => {
    event.preventDefault();
    const el = event.target as HTMLElement;
    if (
      !el.closest(".vuerd-table") &&
      !el.closest(".vuerd-memo") &&
      !el.closest(".vuerd-contextmenu") &&
      !el.closest(".vuerd-minimap") &&
      !el.closest(".vuerd-minimap-handle")
    ) {
      const { store } = this.context;
      store.dispatch(drawRelationship(event.offsetX, event.offsetY));
    }
  };

  private observeDrawRelationship() {
    const { store } = this.context;
    const { drawRelationship } = this.context.store.editorState;
    if (drawRelationship) {
      store.observe(drawRelationship.end, () => this.requestUpdate());
    }
  }
  private unsubscribeDrawRelationship() {
    this.subDrawRelationship?.unsubscribe();
    this.subDrawRelationship = null;
  }
}
