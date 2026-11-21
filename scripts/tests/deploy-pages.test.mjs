import assert from "node:assert/strict";
import { test } from "node:test";
import { deployPages } from "../deploy-pages.mjs";

const create = "POST /repos/{owner}/{repo}/pages/deployments";
const status =
  "GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}";

function fixture(respond) {
  const calls = [];
  const waits = [];
  let time = 0;
  return {
    calls,
    waits,
    run: (artifactId = "14709432678") =>
      deployPages({
        artifactId,
        context: { repo: { owner: "test", repo: "ikio" }, sha: "commit" },
        core: { getIDToken: async () => "test-token", info() {}, warning() {} },
        github: {
          async request(route, parameters) {
            calls.push([route, parameters]);
            return { data: await respond(route, calls.length) };
          },
        },
        wait: async (ms) => {
          waits.push(ms);
          time += ms;
        },
        now: () => time,
      }),
  };
}

test("uses the uploaded ID and retries when Pages has not indexed it", async () => {
  const f = fixture((route, count) => {
    if (count === 1)
      throw Object.assign(Error("Artifact not found"), { status: 400 });
    if (route === create) return { id: "deployment" };
    if (count === 3) return { status: "building" };
    return { status: "succeed" };
  });
  await f.run();
  const payload = {
    owner: "test",
    repo: "ikio",
    artifact_id: 14709432678,
    pages_build_version: "commit",
    oidc_token: "test-token",
  };
  assert.deepEqual(f.calls, [
    [create, payload],
    [create, payload],
    [
      status,
      { owner: "test", repo: "ikio", pages_deployment_id: "deployment" },
    ],
    [
      status,
      { owner: "test", repo: "ikio", pages_deployment_id: "deployment" },
    ],
  ]);
  assert.deepEqual(f.waits, [5000, 5000]);
});

test("stops retrying a missing artifact after six attempts", async () => {
  const f = fixture(() => {
    throw Object.assign(Error("Artifact does not exist"), { status: 404 });
  });
  await assert.rejects(f.run(), /HTTP 404.*Artifact does not exist/);
  assert.equal(f.calls.length, 6);
});

test("surfaces a permanent create error without retrying or exposing the token", async () => {
  const f = fixture(() => {
    throw Object.assign(Error("Forbidden: test-token"), { status: 403 });
  });
  await assert.rejects(f.run(), /HTTP 403.*Forbidden: \[redacted\]/);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.waits, []);
});

test("requires a valid ID before requesting a deployment", async () => {
  const f = fixture(() => assert.fail("Unexpected request"));
  await assert.rejects(f.run(""), /invalid Pages artifact ID/);
  assert.deepEqual(f.calls, []);
});

test("fails when Pages rejects the deployed content", async () => {
  const f = fixture((route) =>
    route === create
      ? { id: "deployment" }
      : { status: "deployment_content_failed" },
  );
  await assert.rejects(f.run(), /deployment_content_failed/);
  assert.equal(f.calls.length, 2);
});

test("cancels the same deployment if it times out", async () => {
  const f = fixture((route) =>
    route === create ? { id: "deployment" } : { status: "building" },
  );
  await assert.rejects(f.run(), /deployment timed out/);
  assert.deepEqual(f.calls.at(-1), [
    "POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel",
    { owner: "test", repo: "ikio", pages_deployment_id: "deployment" },
  ]);
});
