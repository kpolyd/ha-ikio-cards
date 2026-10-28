import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkReview(browser) {
  const page = await browser.newPage({
    viewport: { width: 740, height: 1000 },
  });
  try {
    await page.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const alarm = page.locator("ikio-alarmo-card");
    await alarm.scrollIntoViewIfNeeded();
    await alarm.evaluate((c) => {
      c.preview = true;
      c.activity.stop();
      c.activity.entries = Array.from({ length: 2000 }, (_, i) => ({
        entity_id: c.config.entity,
        state: "disarmed",
        when: Date.now() / 1000 - i - 1,
        context_id: "review-" + i,
      }));
      c.update();
    });
    assert.ok((await alarm.locator(".security-activity-row").count()) <= 100);
    await alarm.evaluate((c) => {
      const v = c.content.querySelector(".security-activity-scroll");
      v.scrollTop = v.scrollHeight;
      v.dispatchEvent(new Event("scroll"));
    });
    await page.waitForFunction(() =>
      document
        .querySelector("ikio-alarmo-card")
        .content.querySelector('[data-key$="review-1999"]'),
    );
    assert.ok((await alarm.locator(".security-activity-row").count()) <= 100);
    await alarm.evaluate((c) => {
      const v = c.content.querySelector(".security-activity-scroll");
      v.scrollTop = 0;
      v.dispatchEvent(new Event("scroll"));
    });
    await page.waitForFunction(() =>
      document
        .querySelector("ikio-alarmo-card")
        .content.querySelector('[data-key$="review-0"]'),
    );
    assert.equal(
      await alarm.evaluate((c) => {
        const old = c.content.querySelector('[data-key$="review-0"]');
        c.activity.entries.unshift({
          entity_id: c.config.entity,
          state: "disarmed",
          when: Date.now() / 1000,
          context_id: "new",
        });
        c.update();
        return old.isConnected;
      }),
      true,
    );
    const media = page.locator("ikio-media-card");
    await media.scrollIntoViewIfNeeded();
    assert.equal(
      await media.evaluate((c) => {
        let renders = 0;
        const render = c.render.bind(c);
        c.render = () => {
          renders++;
          return render();
        };
        c.tickPlayback();
        return renders;
      }),
      0,
    );
    return { card: "review-regressions", passed: true };
  } finally {
    await page.close();
  }
}
