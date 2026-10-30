import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, normalizeConfig } from "./config.js";
defineEditor("ikio-battery-card-editor", fields, [], normalizeConfig);
