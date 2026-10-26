import { el, event, button, row, note } from "./controls.js";

// Opt-in presentation: approved Light/Energy/Drive/Security cards do not use it.
export function installRefinement(card) {
  card.shadowRoot.prepend(
    el(
      "style",
      `
    .ikio-refined{gap:6px}
    .ikio-refined>header{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:6px;margin:0;align-items:center}
    .ikio-refined>header>.ae-title,.ikio-refined>header>h2{font-size:16px;font-weight:500;line-height:1.3}
    .ikio-refined>header>.summary{font-size:11px;text-align:end;max-width:100px;overflow-wrap:anywhere}
    .ikio-refined>header>ha-icon{--mdc-icon-size:18px;color:var(--ae-muted)}
    .ikio-refined .ae-select{display:grid;grid-template-columns:minmax(48px,.7fr) minmax(0,1.3fr);gap:8px;align-items:center;font-size:12px;color:var(--ae-muted)}
    .ikio-refined .ae-select>.sr{position:static;width:auto;height:auto;clip-path:none;overflow:visible}
    .ikio-refined .ae-select select{color:var(--ae-text);min-width:0}
    .ikio-refined .ae-row{gap:8px}
    .ikio-refined .ae-reading .ae-value{font-weight:500;font-variant-numeric:tabular-nums}
    .ikio-refined .ae-hero .ae-value{font-size:24px}
    .ikio-refined .ae-reading .ae-label{font-size:11px}
    .ikio-refined .ikio-primary{background:var(--ae-active);border-color:var(--ae-border)}
    .ikio-refined .ikio-disclosure{border-top:1px solid var(--ae-border);padding-top:2px}
    .ikio-refined .ikio-disclosure>summary{display:flex;justify-content:space-between;gap:8px;list-style:none;font-size:12px;color:var(--ae-muted)}
    .ikio-refined .ikio-disclosure>summary::-webkit-details-marker{display:none}
    .ikio-refined .ikio-disclosure>summary:after{content:'+';font-size:18px}
    .ikio-refined .ikio-disclosure[open]>summary:after{content:'−'}
    .ikio-refined .ikio-disclosure-body{display:grid;gap:6px;padding-bottom:4px}
    .ikio-refined .ikio-disclosure:not([open])>.ikio-disclosure-body{display:none}
    .ikio-refined .ikio-review{border-top:1px solid var(--ae-border);padding-top:10px;display:grid;gap:8px}
    .ikio-refined .ikio-review .ae-row{justify-content:flex-end}
    .ikio-refined .ikio-review .ae-row>*{flex:0 1 auto}
    .ikio-refined .ikio-review h3{font-size:14px;font-weight:500;margin:0}
    .ikio-refined .ikio-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:8px}
    .ikio-refined .ikio-metrics>.ae-reading{padding:2px 0}
    .ikio-refined .ikio-metrics .ae-hero .ae-value{font-size:22px}
    .ikio-refined .ikio-fridge .ae-value{font-size:18px;color:var(--ae-fridge)}
    .ikio-refined .ikio-fridge .ae-label{color:var(--ae-fridge)}
    .ikio-refined .ikio-fridge ha-icon{--mdc-icon-size:14px;vertical-align:middle;margin-inline-end:4px}
    .ikio-refined .ikio-device-tabs{padding:3px;background:var(--ae-well);border-radius:10px;gap:3px}
    .ikio-refined .ikio-device-tabs .ae-button{border:0;background:transparent;font-size:12px;padding:6px}
    .ikio-refined .ikio-device-tabs .ae-button[aria-pressed=true]{background:var(--ae-active)}
    .ikio-refined .ikio-media-info{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
    .ikio-refined .ikio-artwork{width:44px;height:44px;object-fit:cover;border-radius:8px}
    .ikio-refined .ikio-track{font-size:15px;line-height:1.35;overflow-wrap:anywhere}
    .ikio-refined .ikio-artist{margin-top:4px;font-size:12px;color:var(--ae-muted);overflow-wrap:anywhere}
    .ikio-refined .ikio-camera-open,.ikio-refined .ikio-labelled-action{display:flex;align-items:center;justify-content:center;gap:8px}
    .ikio-refined .ikio-transport{justify-content:center}
    .ikio-refined .ikio-transport>.ae-icon{flex:0 0 44px}
    .ikio-refined .ikio-transport .ikio-primary{border-radius:50%}
    .ikio-refined .ikio-resource{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px}
    .ikio-refined .ikio-resource>.ae-reading{grid-column:1/-1;min-height:44px;flex-direction:row;align-items:center;justify-content:space-between}
    .ikio-refined .ikio-resource>.ae-progress{grid-column:1/-1;height:3px}
    .ikio-refined .ikio-resource>.ae-note{grid-column:1/-1}
    .ikio-refined .ikio-service{border-top:1px solid var(--ae-border);padding-top:8px}
    .ikio-refined .ikio-camera-placeholder{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;min-height:56px;background:var(--ae-well);border-radius:8px;padding:6px 8px}
    .ikio-refined .ikio-camera-placeholder>ha-icon{--mdc-icon-size:28px;color:var(--ae-muted)}
    .ikio-refined .ikio-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px}
    .ikio-refined .ikio-legend-entry{display:grid;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:6px}
    .ikio-refined .ikio-line-sample{width:22px;border-top:2px solid var(--ae-accent)}
    .ikio-refined .ikio-line-sample.dashed{border-top-style:dashed}
    .ikio-refined .ikio-line-sample.dotted{border-top-style:dotted}
    .ikio-refined .ikio-resources{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:8px}
    .ikio-refined .ikio-resources .ikio-resource>.ae-reading{flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;padding:2px 0}
    .ikio-refined .ikio-resources .ae-value{font-size:16px}
    .ikio-refined .ikio-server-monitor-metadata{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 8px}
    .ikio-refined .ikio-server-monitor-metadata>.ae-reading{flex-direction:row;align-items:center;justify-content:space-between;gap:6px;padding:0}
    .ikio-refined .ikio-server-monitor-metadata>.ae-note{grid-column:1/-1}
    .ikio-refined .ikio-resource>.ae-note{font-size:11px}
    .ikio-refined .ikio-climate-controls>.ae-select,.ikio-refined .ikio-climate-controls>.ae-range{flex:1 1 130px}
    .ikio-refined .ikio-climate-controls>.ae-range{grid-template-columns:minmax(44px,.6fr) minmax(0,1.4fr)}
    .ikio-refined .ikio-media-audio{align-items:center}
    .ikio-refined .ikio-media-audio>.ae-row{flex:2 1 170px}
    .ikio-refined .ikio-media-audio>.ae-select{flex:1 1 150px}
    .ikio-refined .ikio-footer{align-items:flex-start}
    .ikio-refined .ikio-footer>.ae-reading{flex-direction:row;align-items:center;justify-content:space-between;gap:6px}
    .ikio-refined .ikio-footer>.ikio-disclosure{border-top:0;padding-top:0}
    .ikio-refined .ikio-vacuum-controls>.ae-row,.ikio-refined .ikio-vacuum-controls>.ae-select{flex:1 1 150px}
    .ikio-refined .ikio-action-bar>.ae-row:first-child{flex:1 1 160px}
    .ikio-refined .ikio-action-bar>.ae-row:last-child{flex:0 1 auto}
    .ikio-refined .ikio-camera-placeholder>.ae-note{flex:1 1 90px}
    .ikio-refined .ikio-camera-open{flex:none}
    @container(max-width:310px){.ikio-refined>header>.summary{max-width:80px}}
  `,
    ),
  );
  for (const hook of ["onConfig", "onDisconnect", "onVisibility"]) {
    const original = card[hook]?.bind(card);
    card[hook] = (...args) => {
      if (hook !== "onVisibility" || !card.visible) {
        card.review = undefined;
        if (hook === "onConfig") card.openSections = new Set();
      }
      original?.(...args);
    };
  }
}

export function refine(result, name) {
  result.classList.add("ikio-refined");
  const header = result.querySelector("header");
  if (header) header.prepend(glyph(name));
  return result;
}
export function glyph(name) {
  const node = el("ha-icon");
  node.setAttribute("icon", name);
  node.setAttribute("aria-hidden", "true");
  return node;
}
export function disclosure(card, key, label, ...children) {
  const node = el("details", undefined, "ikio-disclosure", key);
  node.open = card.openSections?.has(key) || false;
  event(node, "toggle", (e) => {
    card.openSections ||= new Set();
    if (e.currentTarget.open) card.openSections.add(key);
    else card.openSections.delete(key);
  });
  node.append(el("summary", label));
  const body = el("div", undefined, "ikio-disclosure-body");
  body.append(...children.filter(Boolean));
  node.append(body);
  return node;
}
export function requestReview(card, id, label, explanation, submit) {
  if (card.blocked(id)) return;
  card.review = { id, label, explanation, submit };
  card.update();
}
export function reviewView(card) {
  const review = card.review;
  if (!review) return null;
  const section = el("section", undefined, "ikio-review", "inline-review");
  section.setAttribute("aria-label", review.label);
  section.append(el("h3", review.label), note(review.explanation, "ae-warn"));
  const cancel = button(
    "Cancel",
    () => {
      card.review = undefined;
      card.update();
    },
    { key: "cancel-review" },
  );
  const confirm = button(
    "Confirm",
    () => {
      if (card.blocked(review.id) || card.review !== review) return;
      card.review = undefined;
      review.submit();
      card.update();
    },
    { key: "confirm-review", disabled: card.blocked(review.id) },
  );
  section.append(row(cancel, confirm));
  return section;
}
