import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, lists, normalize } from "./config.js";
defineEditor("ikio-climate-card-editor", fields, lists, normalize);
