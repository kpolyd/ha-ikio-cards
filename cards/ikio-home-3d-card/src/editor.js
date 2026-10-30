import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, normalizeConfig, editorOptions } from "./config.js";
defineEditor(
  "ikio-home-3d-card-editor",
  fields,
  [],
  normalizeConfig,
  editorOptions,
);
