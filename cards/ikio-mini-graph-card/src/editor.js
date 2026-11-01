import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, lists, normalizeConfig } from "./config.js";
defineEditor("ikio-mini-graph-card-editor", fields, lists, normalizeConfig);
