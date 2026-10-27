import { entity, validateConfig } from "@ikio/card-ui/schema-editor";
export const fields = [entity("entity", "Sensor", "sensor", true)];
export const validate = (c) => validateConfig(c, fields);
