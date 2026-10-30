import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, lists, migrateConfig, editorOptions } from "./config.js";
defineEditor(
  "ikio-server-monitor-card-editor",
  fields,
  lists,
  migrateConfig,
  editorOptions,
);
