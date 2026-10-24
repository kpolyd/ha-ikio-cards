# Ikio graph renderer

Shared by Graph and Energy. Fixed normalized mint/green/yellow/orange/red/purple stops; encoded sRGB interpolation. Users set only expected minimum/maximum. History uses HA's authenticated `history/history_during_period` WebSocket command, verified against the frontend history data module. No recorder means a readable live-state card with a history error message. Requests are deduplicated per connection/minute; offscreen/hidden refresh pauses. Obsolete results are ignored. Peak/gap-preserving samples are bounded; colours follow values and never clip outliers.

Energy can request observed min/mid/max axis labels, subtle dashed guides and a display-only axis formatter. Guides and label positions use the same unrounded value scale. Colour bounds and plotted points are unchanged. Constant history uses one guide, and a midpoint that rounds to an endpoint label is omitted. The standalone Graph appearance remains unchanged by default.
