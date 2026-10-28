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

test("commands emit one selection tick directly to window, including when disabling a button", () => {
  const dom = new JSDOM(
    "<div><button><span>Toggle</span></button><p>Reading</p></div>",
  );
  const root = dom.window.document.querySelector("div");
  const button = root.querySelector("button");
  const feedback = [];
  dom.window.addEventListener("haptic", (e) =>
    feedback.push([e.detail, e.composed]),
  );
  const pulse = bindHaptics(root);
  let forwarded = 0;
  root.addEventListener("haptic", () => forwarded++);
  button.addEventListener("click", () => {
    button.disabled = true;
    pulse();
    pulse();
  });
  button.querySelector("span").click();
  assert.deepEqual(feedback, [["selection", false]]);
  assert.equal(forwarded, 0);
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
  const pulse = bindHaptics(root, () => !preview);
  button.addEventListener("click", pulse);
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

test("details, navigation, disclosures, PIN input and change events remain silent", async () => {
  const dom = new JSDOM(
    '<div><button>Details</button><a href="#">Navigate</a><details><summary>More</summary></details><input type="range"><select><option>A</option></select></div>',
  );
  const root = dom.window.document.querySelector("div");
  const pulse = bindHaptics(root);
  const feedback = [];
  dom.window.addEventListener("haptic", (e) => feedback.push(e.detail));
  root.querySelector("button").click(); // no command
  root.querySelector("a").click();
  root.querySelector("summary").click();
  await Promise.resolve();
  for (const tag of ["input", "select"]) {
    root.querySelector(tag).addEventListener("change", pulse);
    root.querySelector(tag).dispatchEvent(new dom.window.Event("change"));
  }
  pulse(); // a background/programmatic command is not a button action
  assert.deepEqual(feedback, []);
  dom.window.close();
});
