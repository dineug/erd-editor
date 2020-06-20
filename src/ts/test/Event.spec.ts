import { Bus, EventBus, createWindowEventObservable } from "@src/core/Event";

function createTouch(clientX: number, clientY: number): Touch {
  return {
    clientX,
    clientY,
    screenX: 0,
    screenY: 0,
    pageX: 0,
    pageY: 0,
    altitudeAngle: 0,
    azimuthAngle: 0,
    force: 0,
    identifier: 0,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    target: new EventTarget(),
    touchType: "direct",
  };
}

it("event bus", (done) => {
  // given
  const eventBus = new EventBus();
  const message = "test";

  // then
  eventBus.on(Bus.Editor.importErrorDDL).subscribe((event: CustomEvent) => {
    expect(event.detail.message).toBe(message);
    done();
  });

  // when
  eventBus.emit(Bus.Editor.importErrorDDL, {
    message,
  });
});

it("move$ mousemove", (done) => {
  // given
  const windowEventObservable = createWindowEventObservable();

  // then
  windowEventObservable.move$.subscribe(() => done());

  // when
  window.dispatchEvent(new MouseEvent("mousemove"));
});

it("move$ touchmove", (done) => {
  // given
  const windowEventObservable = createWindowEventObservable();

  // then
  windowEventObservable.move$.subscribe((move) => {
    expect(move.movementX).toBe(100);
    expect(move.movementY).toBe(100);
    done();
  });

  // when
  window.dispatchEvent(
    new TouchEvent("touchstart", {
      touches: [createTouch(100, 100)],
    })
  );
  window.dispatchEvent(
    new TouchEvent("touchmove", {
      touches: [createTouch(200, 200)],
    })
  );
});
