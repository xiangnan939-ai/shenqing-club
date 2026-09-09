# Local Simulation Multiplayer Update

The browser game is built from `/Users/xn/Documents/ChatGPT/游戏制作` using
`npm run build:web`. The generated `web-dist` files are copied to
`games/dandan-racing` in this repository.

## Behavior

- Each human car is simulated only on its owner's browser. The host has no guest
  `Vehicle` instance, receives no guest inputs, and does not reconcile positions.
- R recovers immediately locally and reliably announces the resulting pose.
- Movement uses compact snapshots at 12 Hz over the unreliable state channel.
  The host relays guest snapshots to the other guests, excluding their sender.
- Remote cars use a bounded 100 ms interpolation buffer and at most 150 ms of
  extrapolation. Packet sequence numbers discard late data after recovery.
- Local collisions affect locally owned bodies only; remote bodies remain
  display/collision proxies. The host simulates optional AI cars and distributes
  their poses. Contacts can differ under latency; there is no host correction.
- Local finish times are reported reliably and collected for the results screen.
- Protocol version 2 prevents starting a mixed old/new simulation room.
- Local vehicle rendering interpolates fixed physics steps. Camera vectors are
  reused, material compilation occurs during loading, and idle tire effects no
  longer upload unchanged buffers. Online driving uses the saved vehicle upgrades.

## Verification

- `npm test`: 94 tests passed, including all five courses and shortcut recovery.
- `node scripts/web-relay-qa.mjs`: three browser players, one AI, 180 ms added
  delay per connection and every seventh state packet dropped. Guest R recovered
  immediately while host simulation was paused, remained in place after delayed
  messages, and was relayed to the third player. Returned to room and started a
  second race successfully. No browser errors; about 12 state packets/second.
- The same browser test loaded a legacy save and checked coins, upgrades and
  purchased/equipped effects. No production save write or database migration is
  involved in this release.
- `node scripts/web-smoothness-qa.mjs`: local automated driving on the industrial
  and volcano courses at 1440x900. Both median frame times were 16.7 ms, p95 about
  18.6 ms, with no frames over 50 ms in the final 360-frame samples per course.
  These are short measurements on this Mac, not a guarantee for all devices.
- Constant-speed rendering test: 139 samples with less than 0.001 m of motion
  error after accounting for frame duration. Screenshots showed rendered cars,
  roads and HUDs. No browser errors.

Existing production account saves are preserved. All players should refresh the
game and create a new room after this deployment.
