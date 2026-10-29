import { defineEditor } from "@ikio/card-ui/schema-editor";
import { fields, normalizeConfig } from "./config.js";
defineEditor("ikio-entity-card-editor", fields, [], normalizeConfig);
