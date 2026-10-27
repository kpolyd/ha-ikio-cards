import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, lists, normalize } from "./config.js";
defineEditor("ikio-media-card-editor", fields, lists, normalize);
