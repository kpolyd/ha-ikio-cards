import { LabelType } from "./enums.js";
export function getLabels(entities, openings) {
  return entities
    .filter((entity) => entity.type)
    .map(({ room, demo, ...label }) => {
      if (label.type !== LabelType.CONTACT) return label;
      const opening = openings.find(
        (opening) => opening.entity === label.entity,
      );
      return {
        ...label,
        position: {
          ...label.position,
          x: opening?.x ?? label.position.x,
          z: opening?.z ?? label.position.z,
        },
      };
    });
}
