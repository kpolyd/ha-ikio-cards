# Tap and hold actions

The collapsed **Actions** section contains **Tap action** and **Hold action** only. There is no separate Action entity selector. It is available on Lights, Entity, Chip (including badges), Climate, Dehumidifier, Media, Vacuum, Weather and Mini Graph.

Electricity, Router, Server Monitor, Batteries, Graph, Vehicle, Alarmo and Home 3D have no Actions section. Their dedicated controls, sensor details and canvas gestures keep their normal behaviour. Old saved action keys are preserved when editing but do not install custom header actions on these cards.

Lights applies the configured action to the light or switch pressed. Entity and Chip use their configured entity. Other supported cards use their primary entity; Mini Graph uses `primary_entity`, while its secondary reading retains native details. Larger cards apply actions to the header/main entity area. Dedicated power, mode, slider, transport, tab and disclosure controls keep their normal behaviour.

Choose **More info**, **Toggle**, **Perform action**, **Navigate**, **Open URL**, or **None** with Home Assistant's native action editor. **Default** keeps each card's native tap/hold behaviour. More info and Toggle use the card's entity. Perform action keeps service parameters, such as brightness, and targets the card's entity. Saved card/action entity overrides, explicit targets and target-selection keys in service data cannot redirect it to other devices. Choose a service compatible with the configured entity. Navigation and URL use their configured destinations.

Use click or Enter/Space on the action area. Hold runs once and suppresses the following click; Shift+Enter runs the hold action with a keyboard. Custom commands, navigation and details are disabled in editor previews. Unavailable entities can still open details or navigate but cannot toggle. Confirmation is inline. Reconfiguring or disconnecting cancels pending holds and reviews.

URLs must use HTTP or HTTPS. Navigate accepts a local path starting with `/` and signals Home Assistant after updating browser history. Errors remain visible in the card. Actual integration capabilities and Home Assistant permissions still apply.
