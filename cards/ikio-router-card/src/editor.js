import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, lists, editorOptions } from "./config.js";
defineEditor(
  "ikio-router-card-editor",
  fields,
  lists,
  undefined,
  editorOptions,
);
