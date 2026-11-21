import { setTimeout as sleep } from "node:timers/promises";

const deploymentRoute = "/repos/{owner}/{repo}/pages/deployments";
const statusRoute = `${deploymentRoute}/{pages_deployment_id}`;
const finalFailures = new Set([
  "deployment_failed",
  "deployment_perms_error",
  "deployment_content_failed",
  "deployment_cancelled",
  "deployment_lost",
]);

function artifactNotReady(error) {
  return (
    [400, 404, 422].includes(error.status) &&
    /\bartifact\b[^.\n]{0,120}\b(?:not found|does not exist|not (?:yet )?(?:available|ready))\b|\bno artifact\b/i.test(
      error.message,
    )
  );
}

export async function deployPages({
  github,
  context,
  core,
  artifactId,
  wait = sleep,
  now = Date.now,
}) {
  const id = Number(artifactId);
  if (!/^\d+$/.test(artifactId) || !Number.isSafeInteger(id) || id < 1)
    throw Error("Missing or invalid Pages artifact ID from the upload step");

  const token = await core.getIDToken();
  const payload = {
    ...context.repo,
    artifact_id: id,
    pages_build_version: context.sha,
    oidc_token: token,
  };
  let deployment;
  for (let attempt = 1; ; attempt++) {
    try {
      ({ data: deployment } = await github.request(
        `POST ${deploymentRoute}`,
        payload,
      ));
      break;
    } catch (error) {
      if (attempt === 6 || !artifactNotReady(error)) {
        const message = String(error.message).replaceAll(token, "[redacted]");
        throw Error(
          `Could not deploy Pages artifact ${id} (HTTP ${error.status ?? "unknown"}): ${message}`,
        );
      }
      core.info(`Pages cannot see artifact ${id} yet (attempt ${attempt}/6)`);
      await wait(5_000);
    }
  }

  const deploymentId = deployment.id ?? context.sha;
  const parameters = { ...context.repo, pages_deployment_id: deploymentId };
  core.info(`Created Pages deployment ${deploymentId} for artifact ${id}`);
  const deadline = now() + 10 * 60_000;
  while (now() < deadline) {
    try {
      const { data } = await github.request(`GET ${statusRoute}`, parameters);
      if (data.status === "succeed") {
        core.info(`Pages deployment ${deploymentId} succeeded`);
        return;
      }
      if (finalFailures.has(data.status))
        throw Error(`Pages deployment ${deploymentId}: ${data.status}`);
    } catch (error) {
      if (![404, 429].includes(error.status) && !(error.status >= 500))
        throw error;
      core.warning(
        `Pages status temporarily unavailable (HTTP ${error.status})`,
      );
    }
    await wait(5_000);
  }
  try {
    await github.request(`POST ${statusRoute}/cancel`, parameters);
  } catch (error) {
    core.warning(
      `Could not cancel Pages deployment ${deploymentId}: ${error.message}`,
    );
  }
  throw Error(`Pages deployment ${deploymentId} timed out`);
}
