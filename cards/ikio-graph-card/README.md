# Ikio Graph

A compact numeric-history card using the Electricity chart's value-colour palette, shallow area fill, thin 0.8 px lines, dashed min/mid/max guides and quiet min/max and time labels. The current reading sits in the header for one sensor. Multiple same-unit sensors share one axis with solid/dashed/dotted patterns and a compact reading legend. Missing history stays a gap; missing current values remain explicit.

Add Ikio Graph through the visual card picker after installing the collection through HACS. Pick one or more numeric sensors and optional display names. **History hours** defaults to six. **Show readings** defaults on (the existing saved key is `show_legend`). The optional **Colour range** disclosure accepts minimum/maximum values; blank means automatic from the visible history. Per-sensor colour overrides remain available in each entity row. Existing saved ranges keep their behaviour. The plot's axis always follows the visible history; mixed units are rejected instead of sharing a misleading scale.

Use Home Assistant's native **Layout** settings in a Sections dashboard to resize the card. Graph advertises a six-column, three-row default and three-column/three-row minimum. The chart fills the assigned width and height while text and line thickness remain readable. Other dashboard layouts control their own sizing. No separate Ikio height/width field is needed. Existing `grid_options`, `view_layout`, visibility and other HA metadata survive visual edits.

The shared **Actions** section and dark/light/Home Assistant **Appearance** selector remain available. Defaults keep native entity details on the single-sensor title and readings; custom header tap/hold actions do not replace the individual reading controls. Tap or hold a legend reading to open its native details.

Collection version: [ikio/package.json](../../ikio/package.json). Build/package from the root with the standard repository checks. Automated unit/browser fixtures use simulated data and do not establish native Home Assistant or device outcomes.
