import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, ui;
before(async () => {
  dom = new JSDOM("<body></body>", { url: "http://localhost" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  ui = await import("../src/index.js");
  customElements.define(
    "refinement-fixture",
    class extends ui.ControlCard {
      constructor() {
        super();
        ui.installRefinement(this);
      }
      render() {
        const result = ui.group(ui.title(this, "Fixture", this.config.entity));
        ui.refine(result, "mdi:server-outline");
        result.append(
          ui.disclosure(this, "settings", "Settings", ui.note("Extra content")),
        );
        if (this.review) result.append(ui.reviewView(this));
        return result;
      }
    },
  );
});
after(() => dom.window.close());
function fixture() {
  const card = document.createElement("refinement-fixture");
  card.setConfig({ entity: "switch.test" });
  card.hass = { states: { "switch.test": { state: "off", attributes: {} } } };
  document.body.append(card);
  return card;
}
test("disclosure retains user state across reconciliation and resets on configuration", () => {
  const card = fixture();
  let details = card.shadowRoot.querySelector("details");
  details.open = true;
  details.dispatchEvent(new dom.window.Event("toggle"));
  card.update();
  assert.equal(card.shadowRoot.querySelector("details"), details);
  assert.equal(details.open, true);
  details.open = false;
  details.dispatchEvent(new dom.window.Event("toggle"));
  card.update();
  assert.equal(details.open, false);
  details.open = true;
  details.dispatchEvent(new dom.window.Event("toggle"));
  card.setConfig({ entity: "switch.test" });
  assert.equal(card.shadowRoot.querySelector("details").open, false);
  card.remove();
});
test("inline review requires explicit confirmation and cannot execute a stale or hidden intent", () => {
  const card = fixture();
  let commands = 0;
  ui.requestReview(
    card,
    "switch.test",
    "Restart",
    "Explanation",
    () => commands++,
  );
  assert.equal(commands, 0);
  assert.equal(card.shadowRoot.querySelector("dialog"), null);
  card.shadowRoot.querySelector("[data-key=cancel-review]").click();
  assert.equal(commands, 0);
  assert.equal(card.review, undefined);
  ui.requestReview(
    card,
    "switch.test",
    "Restart",
    "Explanation",
    () => commands++,
  );
  card.shadowRoot.querySelector("[data-key=confirm-review]").click();
  assert.equal(commands, 1);
  ui.requestReview(
    card,
    "switch.test",
    "Restart",
    "Explanation",
    () => commands++,
  );
  const old = card.shadowRoot.querySelector("[data-key=confirm-review]");
  card.visible = false;
  card.onVisibility();
  old.click();
  assert.equal(commands, 1);
  card.remove();
});
test("preview cannot open an actionable review", () => {
  const card = fixture();
  card.preview = true;
  ui.requestReview(card, "switch.test", "Restart", "Explanation", () =>
    assert.fail("preview command"),
  );
  assert.equal(card.review, undefined);
  card.remove();
});
