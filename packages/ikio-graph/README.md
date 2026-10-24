# Ikio graph renderer

Shared by Graph and Energy. Fixed normalized mint/green/yellow/orange/red/purple stops; encoded sRGB interpolation. Users set only expected minimum/maximum. History uses HA's authenticated `history/history_during_period` WebSocket command, verified against the frontend history data module. No recorder means a readable live-state card with a history error message. Requests are deduplicated per connection/minute; offscreen/hidden refresh pauses. Obsolete results are ignored. Peak/gap-preserving samples are bounded; colours follow values and never clip outliers.
