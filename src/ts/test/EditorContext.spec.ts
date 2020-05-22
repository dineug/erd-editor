import { createEditorContext } from "@src/core/EditorContext";

it("create EditorContext", () => {
  const context = createEditorContext();
  expect(context).toBe(context);
});
