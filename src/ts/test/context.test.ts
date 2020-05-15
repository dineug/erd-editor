import { createEditorContext } from "../core/EditorContext";

const context = createEditorContext();

test("jest test", () => {
  const { canvasType } = context.store.canvasState;
  expect(canvasType).toBe(canvasType);
});
