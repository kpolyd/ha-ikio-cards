import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, lists, normalizeEditor, editorOptions } from "./config.js";
defineEditor(
  "ikio-lights-card-editor",
  fields,
  lists,
  normalizeEditor,
  editorOptions,
);
