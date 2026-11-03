# Ikio Mini Graph

Use `custom:ikio-mini-graph-card` for a compact, approximately 100 px summary.
The original `custom:ikio-graph-card` remains available with its existing behavior.

Choose one required numeric primary sensor and one optional secondary entity in
the visual editor. The primary supplies colour range and min/max labels. Numeric secondary history uses an independently scaled grey area with no outline behind the primary graph. A secondary may have another unit; textual states remain live readings only.
Both readings open their own native entity details. Values use 14 px and 12 px;
min/max overlay the plot's left edge, with start/midpoint/end time labels below.
Unavailable readings and missing history remain explicit.

Configuration: optional card name; `primary_entity`; optional `secondary_entity`;
`hours` (default 6); optional `expected_min`/`expected_max` colour limits;
`graph_height` (default 32 px); `show_extrema` and `show_time_labels` (both default
true); and the standard dark/light/Home Assistant appearance and actions.
`points_per_hour` defaults to 12 (whole numbers 1–60), using time-weighted averages and preserving unavailable gaps. `static_colour` defaults to false; enabling it uses the theme accent for the primary line and fill, with no colour picker. Both readings include 11 px muted native entity icons with a 3 px gap.
There is no series list or secondary axis. Native Sections
sizing can enlarge the plot. No YAML is required.
