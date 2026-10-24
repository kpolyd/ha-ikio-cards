import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { bindHold } from "../src/interactions.js";
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
