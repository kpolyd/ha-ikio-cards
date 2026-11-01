# Tap and hold actions

Every Ikio visual editor except Home 3D has a collapsed **Actions** section immediately above **Appearance**. Leaving either selector at **Default** preserves that card's existing behaviour; existing saved configurations need no migration.

Choose **More info**, **Toggle**, **Perform action**, **Navigate**, **Open URL**, or **None** with Home Assistant's native action editor. Its additional target, action/data and destination fields appear when needed. **Action entity (optional)** supplies a different entity for More info or Toggle, and a default entity target for Perform action if its own target is omitted. This is useful for cards without a single main entity, such as Lights, Batteries and multi-series Graph. Explicit targets in the action take precedence.

The action area is the entire standalone Chip, Chip badge or Entity tile. Larger cards use their header/main entity area. Embedded chips, sensor readings and dedicated power, mode, slider, transport, tab and disclosure controls retain their existing interactions. Home 3D retains its canvas gestures and has no Actions section.

Use tap/click or Enter/Space on the action area. Hold runs once and suppresses the following click; Shift+Enter runs the hold action with a keyboard. Custom commands, navigation and details are disabled in editor previews. Unavailable entities can still open details or navigate, but cannot toggle. Toggle only applies to domains supporting that command; use Perform action for other services. Actions that request confirmation show an inline Confirm/Cancel review. Changing the configured entity or disconnecting the card cancels pending holds and reviews.

URLs must use HTTP or HTTPS. Navigate accepts a local path beginning with `/` and signals Home Assistant after updating browser history. Perform action passes the selected data and targets to Home Assistant and reports request errors in the card. Device actions still require the integration's actual capabilities and permissions.
