import { fields, configurationUrl } from "./config.js";
import { resolveConfiguration } from "./resolve-configuration.js";
export class ConfigurationFileError extends Error {
  constructor(key, reason) {
    super(reason);
    this.key = key;
  }
}
export async function loadConfiguration(
  config,
  {
    signal,
    base = window.location.href,
    fetcher = window.fetch.bind(window),
  } = {},
) {
  const sources = fields.map(({ name }) => {
    try {
      return { name, url: configurationUrl(config[name], base) };
    } catch {
      throw new ConfigurationFileError(
        name,
        "Could not read JSON configuration file",
      );
    }
  });
  const values = await Promise.all(
    sources.map(async ({ name, url }) => {
      try {
        const response = await fetcher(url, {
          signal,
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: { Accept: "application/json" },
        });
        if (!response.ok)
          throw new ConfigurationFileError(
            name,
            "Could not load configuration file",
          );
        return await response.json();
      } catch (error) {
        if (signal?.aborted) throw error;
        throw error instanceof ConfigurationFileError
          ? error
          : new ConfigurationFileError(
              name,
              "Could not read JSON configuration file",
            );
      }
    }),
  );
  try {
    return resolveConfiguration(...values);
  } catch {
    throw new ConfigurationFileError(
      "schema",
      "Invalid Home 3D configuration. Check the file structure and references.",
    );
  }
}
