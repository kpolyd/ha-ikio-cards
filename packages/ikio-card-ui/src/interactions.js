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

/** Delegate feedback so rerenders do not add listeners or duplicate taps. */
export function bindHaptics(root, enabled = () => true) {
  const eligible = new WeakSet();
  root.addEventListener(
    "click",
    (event) => {
      const control = event
        .composedPath()
        .find((node) =>
          node.matches?.('button, summary, a[href], [role="button"]'),
        );
      if (
        enabled() &&
        control &&
        !control.matches(':disabled, [aria-disabled="true"]')
      )
        eligible.add(event);
    },
    true,
  );
  // A suppressed hold-click never reaches this listener. Check availability
  // before the action handler can disable its button while awaiting HA.
  root.addEventListener("click", (event) => {
    if (!eligible.has(event)) return;
    const feedback = new root.ownerDocument.defaultView.Event("haptic", {
      bubbles: true,
      composed: true,
    });
    feedback.detail = "light";
    root.dispatchEvent(feedback);
  });
}
