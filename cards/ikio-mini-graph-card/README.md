# Ikio Mini Graph

Use `custom:ikio-mini-graph-card` for a compact, approximately 100 px summary.
The original `custom:ikio-graph-card` remains available with its existing behavior.

Choose one required numeric primary sensor and one optional secondary entity in
the visual editor. Only the primary supplies history, colour range and min/max.
The secondary is a live reading and may have another unit or a textual state.
Both readings open their own native entity details. Values use 14 px and 12 px;
min/max overlay the plot's left edge, with start/midpoint/end time labels below.
Unavailable readings and missing history remain explicit.

Configuration: optional card name; `primary_entity`; optional `secondary_entity`;
`hours` (default 6); optional `expected_min`/`expected_max` colour limits;
`graph_height` (default 32 px); `show_extrema` and `show_time_labels` (both default
true); and the standard dark/light/Home Assistant appearance and actions.
There is no series list and no secondary graph or secondary axis. Native Sections
sizing can enlarge the plot. No YAML is required.
