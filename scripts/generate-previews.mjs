import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const out = resolve(process.env.PREVIEW_OUTPUT || "dist/previews");
const root = resolve(process.env.PREVIEW_SOURCE || ".");
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const hash = (b) => createHash("sha256").update(b).digest("hex");
const server = createServer(async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/html");
    res.end(await readFile(`${out}/index.html`));
  } catch {
    res.statusCode = 500;
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const captures = [];
try {
  for (const theme of ["dark", "light"])
    for (const width of [360, 640])
      for (const scenario of ["normal", "unavailable"]) {
        const page = await browser.newPage({
          viewport: { width: width + 64, height: 1000 },
          deviceScaleFactor: 1,
          locale: "en-US",
          timezoneId: "Europe/Athens",
          reducedMotion: "reduce",
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", (route) =>
          route.request().url().startsWith("http://127.0.0.1:")
            ? route.continue()
            : route.abort(),
        );
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.ikioPreview?.ready);
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width, scenario },
        );
        await page.addStyleTag({
          content:
            "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
        });
        const types = await page.evaluate(() => window.ikioPreview.types);
        for (const type of types) {
          const locator = page.locator(`ikio-${type}-card`);
          const size = await locator.boundingBox();
          if (!size || size.width < 100 || size.height < 20)
            throw Error(`Blank card: ${type}`);
          const overflow = await locator.evaluate((el) =>
            [...el.shadowRoot.querySelectorAll("*")].some(
              (n) =>
                n.clientWidth > 0 &&
                n.scrollWidth > n.clientWidth + 2 &&
                getComputedStyle(n).overflowX === "visible",
            ),
          );
          if (overflow)
            throw Error(
              `Horizontal overflow: ${type}/${theme}/${width}/${scenario}`,
            );
          const file = `screenshots/${type}/${theme}-${width}-${scenario}.png`;
          await mkdir(resolve(out, `screenshots/${type}`), { recursive: true });
          const bytes = await locator.screenshot({
            path: resolve(out, file),
            animations: "disabled",
          });
          captures.push({
            card: type,
            theme,
            width,
            scenario,
            file,
            sha256: hash(bytes),
          });
        }
        if (errors.length) throw Error(errors.join("\n"));
        await page.close();
      }
  // Verify the downloadable HTML works without an HTTP server and mocked actions remain local.
  const offline = await browser.newPage();
  await offline.goto(new URL(`file://${out}/index.html`).href);
  await offline.waitForFunction(() => window.ikioPreview?.ready);
  await offline.evaluate(() => window.ikioPreview.configure({}));
  const before = await offline.evaluate(
    () => window.ikioPreview.states["light.strip"].state,
  );
  await offline
    .locator("ikio-lights-card")
    .locator("button.toggle")
    .first()
    .click();
  await offline.waitForFunction(
    (previous) => window.ikioPreview.states["light.strip"].state !== previous,
    before,
  );
  await offline.close();
  const version = JSON.parse(
    await readFile(`${root}/ikio/package.json`, "utf8"),
  ).version;
  await writeFile(
    `${out}/manifest.json`,
    JSON.stringify(
      {
        schema: 1,
        version,
        sha,
        bundleHash: hash(await readFile(`${root}/dist/ha-ikio-cards.js`)),
        galleryHash: hash(await readFile(`${out}/index.html`)),
        browser: browser.version(),
        clock: "2026-10-26T12:00:00Z",
        captures,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
  server.close();
}
