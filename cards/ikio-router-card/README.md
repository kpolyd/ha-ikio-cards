# Ikio Router

Add card → **Ikio Router** after updating the shared HACS collection. The router works with sensor and binary_sensor entities from any integration; no router brand or cellular connection is required. Configure everything through the visual editor.

## Approved layout

Compact header and uptime; centred extra-reading chips; Internet → router → devices connection path. Addresses appear beneath the icons without repeated Internet/Router/status captions. The globe is green/mint for connected, red for disconnected, muted for unknown/unavailable. It uses an explicit Internet status entity, independently of local router availability or the WAN IP. Tap/hold opens the corresponding entity details; the WAN address has its own target.

Cellular connections have a permanently visible compact section above traffic: network type, optional signal percentage, and independent semicircle gauges for RSRP, RSRQ and SNR/SINR. Unconfigured readings hide; missing/invalid measurements show a dash with no severity arc. Other connection types omit this section.

The traffic legend matches Server Monitor. The graph defaults to 132 px high and 30 minutes. Both series share the observed min/max scale, with a midpoint halfway between those values, units on the left and matching subtle guides. Constant history shows one label/guide instead of three overlapping values. Download is solid, upload dashed. Missing history leaves current rates visible; unknown history has gaps. Only rate sensors are supported, with bit/byte and decimal/binary unit conversion; cumulative totals are not inferred as rates. History batches at most once a minute while visible, with a five-second timeout and stale-response cancellation.

## Visual configuration

All entity bindings are optional and no entity is guessed. Sections: General (name and appearance), Router (availability/local IP/uptime), Internet (status/connected-state override/WAN IP/latency), Devices (count), Network traffic (receive/transmit rates, 5–1440 minutes history, 80–300 px height), Connection (Generic/Ethernet/Fibre/DSL/Cellular), Cellular readings, individual gauge ranges and thresholds, and repeatable Extra readings (sensor/optional name, reorder/remove).

Cellular settings appear only for Cellular and retain saved bindings when another type is selected. Generic is the default; appearance defaults to following Home Assistant. Recognized Internet states include on/off, online/offline, connected/disconnected and up/down, with inverted on/off for problem sensors. A connected-state override compares the exact configured value case-insensitively; other available values mean disconnected. Unknown/unavailable always stay unknown.

Gauge defaults are illustrative configurable display conventions, not a guaranteed radio performance assessment:

| Metric | Minimum | Maximum | Warning below | Critical below |
|---|---:|---:|---:|---:|
| RSRP (dBm) | -130 | -60 | -90 | -110 |
| RSRQ (dB) | -20 | -3 | -10 | -15 |
| SNR/SINR (dB) | -10 | 30 | 13 | 0 |

Bounds clamp the arc only; the actual measurement stays visible. RSRP expects dBm, RSRQ and SNR/SINR expect dB; unitless radio sensors are accepted with the configured metric's unit. Thresholds use strictly below comparisons. Signal percentage must be within 0–100.

Validation uses simulated DOM/browser fixtures and does not claim native Home Assistant or live-router verification. No device actions or service calls are provided.
