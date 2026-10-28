import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { bindHold, bindHaptics } from "../src/interactions.js";
test("hold opens once and suppresses the following click", async () => {
  const dom = new JSDOM("<button></button>");
  const button = dom.window.document.querySelector("button");
  let holds = 0,
    clicks = 0;
  const binding = bindHold(button, () => holds++, { delay: 5 });
  button.addEventListener("click", () => clicks++);
  button.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { clientX: 0, clientY: 0 }),
  );
  await new Promise((r) => setTimeout(r, 15));
  button.click();
  assert.equal(holds, 1);
  assert.equal(clicks, 0);
  binding.destroy();
  dom.window.close();
});
test("moving or disconnect cleanup cancels a pending hold", async () => {
  const dom = new JSDOM("<button></button>");
  const button = dom.window.document.querySelector("button");
  let holds = 0;
  const binding = bindHold(button, () => holds++, { delay: 5 });
  button.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { clientX: 0, clientY: 0 }),
  );
  button.dispatchEvent(
    new dom.window.MouseEvent("pointermove", { clientX: 0, clientY: 20 }),
  );
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(holds, 0);
  button.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  binding.destroy();
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(holds, 0);
  dom.window.close();
});

test("action taps emit one composed light haptic, including when action disables button", () => {
  const dom = new JSDOM(
    "<div><button><span>Toggle</span></button><p>Reading</p></div>",
  );
  const root = dom.window.document.querySelector("div");
  const button = root.querySelector("button");
  const feedback = [];
  dom.window.addEventListener("haptic", (e) =>
    feedback.push([e.detail, e.composed]),
  );
  bindHaptics(root);
  button.addEventListener("click", () => {
    button.disabled = true;
  });
  button.querySelector("span").click();
  assert.deepEqual(feedback, [["light", true]]);
  button.click();
  root.querySelector("p").click();
  assert.equal(feedback.length, 1);
  dom.window.close();
});
test("preview and suppressed hold-clicks do not vibrate", async () => {
  const dom = new JSDOM("<div><button>Toggle</button></div>");
  const root = dom.window.document.querySelector("div");
  const button = root.querySelector("button");
  let preview = true,
    feedback = 0;
  bindHaptics(root, () => !preview);
  dom.window.addEventListener("haptic", () => feedback++);
  button.click();
  preview = false;
  const hold = bindHold(button, () => {}, { delay: 5 });
  button.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((r) => setTimeout(r, 15));
  button.click();
  assert.equal(feedback, 0);
  button.click();
  assert.equal(feedback, 1);
  hold.destroy();
  dom.window.close();
});
