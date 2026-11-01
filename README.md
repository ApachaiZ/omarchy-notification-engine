# Omarchy Notification Engine

The notification daemon behind the optional
[Notification Center](https://github.com/ApachaiZ/omarchy-notification-center).
It owns the freedesktop notification server, displays the toast stack, handles
Do Not Disturb, actions and images, and keeps an optional 30-day history.

While enabled it **replaces `omarchy.notifications`**: there is only one
notification server per session, and the shell's clone guard disables the stock
service. The center is a separate plugin and is **not required** for the engine
to work; conversely, the center works without the engine by reading
`omarchy.notifications` history.

## Install

```bash
omarchy plugin add https://github.com/ApachaiZ/omarchy-notification-engine --enable --yes
```

This installs and enables the engine. `omarchy.notifications` is disabled by
the clone guard; no manual step is needed after the command.

**Warning:** installing this engine replaces `omarchy.notifications` for
notification display and management. Only one server can own the notification
bus. To return to the stock service:

```bash
omarchy plugin remove apach.notification-engine
omarchy plugin enable omarchy.notifications
```

The center can be installed separately and works with either service.

## Capture and history

The engine reads the optional center's settings file
(`~/.local/state/omarchy/notifications-center.json`):

- **Capture toasts On** (default) — received notifications are displayed and
  kept in the 30-day history (up to 1000 entries).
- **Capture toasts Off** — live toasts still display and remain actionable,
  but nothing new is written to history. Existing history is untouched.

Without the center the engine captures by default. The current archive lives in
`~/.local/state/omarchy/notifications-archive.json`; live toasts and their
copied images live under `~/.local/state/omarchy/notifications/`. All of these
are private user state; the private directories are created with mode `0700`.

## Security and privacy

- Notifications are untrusted input. Remote image URLs and non-local URI
  schemes are dropped; `<img>` tags are stripped from bodies before Qt parses
  them.
- The Omarchy `omarchy-exec-argv` action hint runs only after an explicit click
  and is an argv vector, never a shell string. Any session-bus process can set
  it, so treat notifications from untrusted apps as same-user code execution.
- The engine performs no network access and runs inside the existing
  `omarchy-shell` process.
- State files and image copies stay local; state directories are `0700`.

## Remove

```bash
omarchy plugin remove apach.notification-engine
omarchy plugin enable omarchy.notifications
```

History is left untouched.

## Development

The pure notification helpers are tested with Node's built-in runner:

```bash
node --test tests/*.test.mjs
```

## License

GPL-3.0. See [LICENSE](LICENSE). The notification service is derived from
Omarchy's notification plugin and keeps the upstream attribution and license.
