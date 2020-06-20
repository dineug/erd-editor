import { createEditorContext } from "@src/core/EditorContext";
import { shareMouse, shareMouseEnd } from "@src/core/command/share";
import { uuid } from "@src/core/Helper";

describe("command: share", () => {
  it("share.mouse", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { userMouseList } = store.shareState;

    // when
    const userId = uuid();
    const command = shareMouse(10, 10);
    const command2 = shareMouse(10, 10);
    command.user = {
      id: userId,
      name: "user",
    };
    command2.user = {
      id: userId,
      name: "user",
    };
    store.dispatch(command, command2);

    // then
    store.observe(userMouseList, () => {
      expect(userMouseList.length).toBe(1);
      done();
    });
  });

  it("share.mouseEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { userMouseList } = store.shareState;

    // when
    const userId = uuid();
    const commandShareMouse = shareMouse(10, 10);
    const commandShareMouseEnd = shareMouseEnd(userId);
    commandShareMouse.user = {
      id: userId,
      name: "user",
    };
    commandShareMouseEnd.user = {
      id: userId,
      name: "user",
    };
    store.dispatch(commandShareMouse, commandShareMouseEnd);

    // then
    store.observe(userMouseList, () => {
      expect(userMouseList.length).toBe(0);
      done();
    });
  });
});
