import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, lists, normalizeConfig, editorOptions } from "./config.js";
defineEditor(
  "ikio-electricity-card-editor",
  fields,
  lists,
  normalizeConfig,
  editorOptions,
);
