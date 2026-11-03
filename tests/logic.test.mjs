import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"

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

test("an absolute image-path hint survives ingestion", () => {
  const snap = Logic.snapshotOf({
    id: 1, appName: "app", summary: "s", body: "", image: "",
    hints: { "image-path": "/tmp/preview.png" }, urgency: 1, expireTimeout: 0
  }, 5)
  assert.equal(snap.image, "/tmp/preview.png")
  const provider = Logic.snapshotOf({
    id: 3, appName: "app", summary: "s", body: "", image: "image://provider/x",
    hints: { "image-path": "/tmp/preview.png" }, urgency: 1, expireTimeout: 0
  }, 5)
  assert.equal(provider.image, "/tmp/preview.png")
  const remote = Logic.snapshotOf({
    id: 2, appName: "app", summary: "s", body: "", image: "",
    hints: { "image-path": "https://tracker.example/p.png" }, urgency: 1, expireTimeout: 0
  }, 5)
  assert.equal(remote.image, "")
})

test("image, icon and exec hints are clipped at ingestion", () => {
  const huge = "x".repeat(20000)
  const snap = Logic.snapshotOf({
    id: 1, appName: "app", appIcon: "/tmp/" + huge,
    summary: "s", body: "b", image: "file:///tmp/" + huge,
    hints: { "omarchy-exec-argv": huge }, urgency: 1, expireTimeout: 0
  }, 5)
  assert.equal(snap.image.length, Logic.limits.image)
  assert.equal(snap.appIcon.length, Logic.limits.icon)
  assert.equal(snap.execArgv.length, Logic.limits.execArgv)
  const row = Logic.historyEntry({
    app: "app", image: "file:///tmp/" + huge, appIcon: "/tmp/" + huge,
    execArgv: huge, urgency: 1
  }, 1)
  assert.equal(row.image.length, Logic.limits.image)
  assert.equal(row.appIcon.length, Logic.limits.icon)
  assert.equal(row.execArgv.length, Logic.limits.execArgv)
})

test("a one-file legacy history directory is not dropped", () => {
  const single = { app: "a", summary: "one", body: "", timestamp: 1, originalId: 2 }
  assert.deepEqual(Logic.archiveDocuments(JSON.stringify(single)), [single])
  assert.deepEqual(Logic.archiveDocuments(JSON.stringify([single])), [single])
  assert.deepEqual(Logic.archiveDocuments(JSON.stringify({ entries: [single] })), [single])
  assert.deepEqual(Logic.archiveDocuments(JSON.stringify(single) + "\n" + JSON.stringify({ ...single, timestamp: 3 })).length, 2)
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

test("archive writes recheck the pending state (A to B to A)", () => {
  const d = Logic.archiveFlushDecision
  const empty = JSON.stringify({ version: 1, legacyMerged: true, historyMerged: true, entries: [] }) + "\n"
  const nonempty = JSON.stringify({ version: 1, legacyMerged: true, historyMerged: true, entries: [{ stem: "1-2" }] }) + "\n"
  // Desired state equals the last completed write and nothing is pending.
  assert.equal(d(empty, empty, false), "idle")
  assert.equal(d(nonempty, nonempty, false), "idle")
  // Desired state differs and nothing is pending: write now.
  assert.equal(d(nonempty, empty, false), "write")
  // A write is pending and the desired state differs: flag a rewrite.
  assert.equal(d(nonempty, empty, true), "rewrite")
  // The reported case: append B (queued), Clear back to A while B is still
  // writing. The early return must still schedule a corrective save instead
  // of letting B resurrect the cleared private text.
  assert.equal(d(empty, empty, true), "rewrite")
  // Clear back to A while an unrelated C is pending must also recheck.
  assert.equal(d(empty, nonempty, true), "rewrite")
})

test("a queued DND archive copy cannot append after Clear all", () => {
  const allows = Logic.archiveGenerationAllows
  const beforeClear = 3
  const afterClear = 4
  // The copy captured generation 3, then Clear all incremented to 4 while the
  // image job was queued or running. Its completion must be discarded.
  assert.equal(allows(beforeClear, afterClear), false)
  // A write that starts after the clear belongs to the new generation.
  assert.equal(allows(afterClear, afterClear), true)
  assert.equal(allows(beforeClear, beforeClear), true)
  // Missing generations fail closed.
  assert.equal(allows(undefined, afterClear), false)
  assert.equal(allows(NaN, 0), false)
})

test("the DND copy path is fenced by the clear generation", () => {
  const source = readFileSync(new URL("../Service.qml", import.meta.url), "utf8")
  assert.match(source, /function clearArchive\(\) \{\s*service\.archiveGeneration \+= 1/)
  assert.match(source, /function writeArchiveEntry\([\s\S]*?var generation = service\.archiveGeneration/)
  assert.match(source, /archiveGenerationAllows\(generation, service\.archiveGeneration\)[\s\S]*?done\(false\)/)
  assert.match(source, /appendArchiveEntry\(persistable\.entry, generation\)/)
})

test("click actions are structurally bounded", () => {
  assert.deepEqual(Logic.parseExecArgv('["mpv","--","/tmp/a b.mp4"]'), ["mpv", "--", "/tmp/a b.mp4"])
  assert.equal(Logic.parseExecArgv(JSON.stringify(new Array(Logic.execLimits.args + 1).fill("x"))), null)
  assert.equal(Logic.parseExecArgv(JSON.stringify(["x".repeat(Logic.execLimits.argLength + 1)])), null)
  assert.equal(Logic.parseExecArgv(JSON.stringify(["ok", "a\u0000b"])), null)
  assert.equal(Logic.parseExecArgv(JSON.stringify(["x".repeat(Logic.execLimits.total + 1)])), null)
  assert.equal(Logic.parseExecArgv('["-rf"]'), null)
})
