/** A hold never dispatches the subsequent synthetic click. Vertical movement cancels it. */
export function bindHold(target, onHold, { delay = 550 } = {}) {
  let timer,
    origin,
    held = false;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    origin = undefined;
  };
  const down = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    cancel();
    held = false;
    origin = [event.clientX, event.clientY];
    timer = setTimeout(() => {
      held = true;
      onHold();
    }, delay);
  };
  const move = (event) => {
    if (
      origin &&
      Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 8
    )
      cancel();
  };
  const click = (event) => {
    if (held) {
      event.preventDefault();
      event.stopImmediatePropagation();
      held = false;
    }
  };
  const context = (event) => {
    event.preventDefault();
  };
  const listeners = [
    ["pointerdown", down],
    ["pointermove", move],
    ["pointerup", cancel],
    ["pointercancel", cancel],
    ["pointerleave", cancel],
    ["contextmenu", context],
    ["click", click, true],
  ];
  for (const [type, listener, capture] of listeners)
    target.addEventListener(type, listener, capture);
  return {
    get held() {
      return held;
    },
    reset() {
      held = false;
      cancel();
    },
    destroy() {
      cancel();
      for (const [type, listener, capture] of listeners)
        target.removeEventListener(type, listener, capture);
    },
  };
}

/** Only an accepted command during a button click may request feedback. */
export function bindHaptics(root, enabled = () => true) {
  let activation;
  root.addEventListener(
    "click",
    (event) => {
      const button = event
        .composedPath()
        .find((node) => node.matches?.("button"));
      if (
        !enabled() ||
        !button ||
        button.matches(':disabled, [aria-disabled="true"]')
      )
        return;
      const token = {};
      activation = token;
      setTimeout(() => {
        if (activation === token) activation = undefined;
      }, 0);
    },
    true,
  );
  root.addEventListener("click", () => {
    activation = undefined;
  });
  return () => {
    if (!activation || !enabled()) return;
    activation = undefined;
    const view = root.ownerDocument.defaultView;
    const feedback = new view.Event("haptic");
    feedback.detail = "selection";
    // Target the app's window bridge directly: do not bubble through HA's
    // component tree, where another handler may forward the same request.
    view.dispatchEvent(feedback);
  };
}
