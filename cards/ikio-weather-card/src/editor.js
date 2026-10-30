import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, normalizeConfig, editorOptions } from "./config.js";
defineEditor(
  "ikio-weather-card-editor",
  fields,
  [],
  normalizeConfig,
  editorOptions,
);
