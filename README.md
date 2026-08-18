# Display+

An Omarchy (Quattro / Quickshell) bar plugin that replaces the stock **Display**
widget with the same panel plus idle-timeout controls, all driven by the same
kind of sliders the built-in panel uses.

Everything the first-party Display panel does (brightness, text size, scale,
per-monitor enable/disable) is here unchanged. Below it, set:

- **Lid close** action (laptops)
- **Screen saver** delay
- **Displays off** delay
- **Auto-lock** delay
- **Sleep** (suspend) delay
- **Hibernate after sleep** delay

Each timer is a notched slider (snaps to sensible preset stops) instead of a
grid of buttons, matching the feel of the built-in brightness / text-size
sliders.

## How it works

`Display+` clones the first-party `omarchy.monitor` widget
(`manifest.omarchy.clonedFrom`), so it drops into the bar in its place and keeps
the stock keybinding (`SUPER + CTRL + D`) and IPC target working.

The idle logic (screen saver, displays-off DPMS cycle, auto-lock, suspend,
suspend-then-hibernate, lid handling) is a **self-contained service** vendored
from [Sandman](https://github.com/lgse/sandman) — `IdleService.qml`,
`LidService.qml`, and `sandman.py`. No separate Sandman install is required.

Settings live in `~/.config/omarchy/sandman.json` (compatible with Sandman's,
so an existing config carries over).

## Install

Copy the plugin into your Omarchy plugins directory:

```bash
git clone git@github.com:cossssmin/omarchy-display-plus.git \
  ~/.config/omarchy/plugins/cosmin.display
omarchy restart shell
```

Then swap it into the bar where `omarchy.monitor` sat (in
`~/.config/omarchy/shell.json`), replacing its layout entry id with
`cosmin.display`.

## Files

| File | Role |
| --- | --- |
| `Panel.qml` | Bar widget + panel UI (Display sections + timer sliders) |
| `Model.js` | Brightness/scale helpers + timer presets/formatting |
| `IdleService.qml` | Idle cycle, suspend, config IO (vendored from Sandman) |
| `LidService.qml` | Laptop lid handling (vendored from Sandman) |
| `sandman.py` | CLI helper for config + systemd/hypr integration (vendored) |
| `manifest.json` | Plugin manifest (`service` + `bar-widget`, clonedFrom) |

## Credits

- The Display panel is derived from Omarchy's first-party `omarchy.monitor`.
- The idle service is derived from **Sandman** by Pierre Berube (MIT). See
  `LICENSE`.
