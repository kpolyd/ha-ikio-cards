import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, normalize, editorOptions } from "./config.js";
defineEditor("ikio-vacuum-card-editor", fields, [], normalize, editorOptions);
