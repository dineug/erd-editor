import { createEditorContext } from "../core/EditorContext";

test("create EditorContext", () => {
  const context = createEditorContext();
  expect(context).toBe(context);
});
