import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const Logic = require("../NotificationLogic.js")

test("remote notification images are dropped", () => {
  assert.equal(Logic.safeImageSource("https://tracker.example/pixel.png"), "")
  assert.equal(Logic.safeImageSource("http://tracker.example/pixel.png"), "")
  assert.equal(Logic.safeImageSource("data:image/png;base64,AAAA"), "")
  assert.equal(Logic.safeImageSource("file:///tmp/a.png"), "file:///tmp/a.png")
  assert.equal(Logic.safeImageSource("/tmp/a.png"), "/tmp/a.png")
  assert.equal(Logic.safeImageSource("image://provider/a"), "image://provider/a")
})

test("safe app icons keep themed names and local files only", () => {
  assert.equal(Logic.safeAppIcon("firefox"), "firefox")
  assert.equal(Logic.safeAppIcon("org.gnome.Nautilus"), "org.gnome.Nautilus")
  assert.equal(Logic.safeAppIcon("file:///tmp/icon.png"), "file:///tmp/icon.png")
  assert.equal(Logic.safeAppIcon("https://tracker.example/icon.png"), "")
  assert.equal(Logic.safeAppIcon("data:image/png;base64,AAAA"), "")
})

test("image stems are numeric and cannot escape the image directory", () => {
  assert.equal(Logic.imageStem({ timestamp: 123, originalId: 4 }), "123-4")
  assert.equal(Logic.imageStem({ timestamp: "x", originalId: "../bad" }), "0-0")
  assert.equal(Logic.imageStem({ timestamp: -1, originalId: -2 }), "0-0")
})

test("styled bodies strip image tags after the newline rewrite", () => {
  const body = "a\n<img src=\"https://tracker.example/pixel.png\">b"
  assert.equal(Logic.styledBody(body, "app", "icon"), "a<br/>b")
  const edge = "<x\n<img src=\"https://tracker.example/pixel.png\">"
  assert.equal(Logic.styledBody(edge, "app", "icon"), "<x<br/>")
})

test("popup placement clamps a centered panel to the top", () => {
  assert.equal(Logic.popupPlacement("center-center", "top", 26, 8).vertical, "top")
  assert.equal(Logic.popupPlacement("bottom-right", "top", 26, 8).vertical, "bottom")
})

test("oversized notification text is clipped at ingestion", () => {
  const huge = "x".repeat(20000)
  const snap = Logic.snapshotOf({
    id: 1, appName: "a".repeat(400), appIcon: "firefox",
    summary: huge, body: huge, image: "", hints: { "omarchy-glyph": "g".repeat(40) },
    urgency: 1, expireTimeout: 0
  }, 5)
  assert.equal(snap.app.length, Logic.limits.app)
  assert.equal(snap.summary.length, Logic.limits.summary)
  assert.equal(snap.body.length, Logic.limits.body)
  assert.equal(snap.glyph.length, Logic.limits.glyph)
  assert.equal(Logic.clipText("a\u0000b", 10), "ab")
})

test("oversized history rows are clipped when loaded from disk", () => {
  const row = Logic.historyEntry({
    app: "a".repeat(400), summary: "s".repeat(2000), body: "b".repeat(20000)
  }, 1)
  assert.equal(row.app.length, Logic.limits.app)
  assert.equal(row.summary.length, Logic.limits.summary)
  assert.equal(row.body.length, Logic.limits.body)
})
