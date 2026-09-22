let fixture: [String: Any] = [
    "type": "runner.state",
    "protocolVersion": 1,
    "sessionId": "test-session",
    "revision": 2,
    "sentAt": "2026-09-21T12:00:00.000Z",
    "updatedAt": "2026-09-21T12:00:00.000Z",
    "status": "running",
    "currentIndex": 0,
    "totalExercises": 2,
    "currentExercise": ["id": "item-1", "exerciseId": "exercise-1", "name": "Current", "remainingSeconds": 60, "durationSeconds": 60],
    "nextExercise": ["id": "item-2", "exerciseId": "exercise-2", "name": "Next"],
    "className": "Test class"
]

func decodeFixture(_ changes: [String: Any] = [:]) throws -> WatchRunnerState {
    let payload = fixture.merging(changes) { _, replacement in replacement }
    return try WatchRunnerState.decode(JSONSerialization.data(withJSONObject: payload))
}

let running = try decodeFixture()
precondition(running.currentExercise?.name == "Current")
precondition(running.nextExercise?.name == "Next")
precondition(running.remainingSeconds(at: running.sentAt) == 60)
print("PASS: phone payload decodes without receivedAt")

let delayedNow = running.sentAt.addingTimeInterval(25)
precondition(running.remainingSeconds(at: delayedNow) == 35)
let duplicate = try decodeFixture()
precondition(duplicate.remainingSeconds(at: delayedNow) == 35)
print("PASS: delayed and duplicate messages preserve countdown")

precondition(running.remainingSeconds(at: running.sentAt.addingTimeInterval(90)) == 0)
precondition(running.remainingSeconds(at: running.sentAt.addingTimeInterval(-10)) == 60)
print("PASS: countdown is clamped at zero and tolerates future timestamps")

let paused = try decodeFixture(["status": "paused"])
precondition(paused.remainingSeconds(at: delayedNow) == 60)
let completed = try decodeFixture(["status": "completed", "currentExercise": NSNull(), "nextExercise": NSNull()])
precondition(completed.remainingSeconds(at: delayedNow) == 0)
print("PASS: paused and completed states do not count down")

let precise = try decodeFixture([
    "sentAt": "2026-09-21T12:00:00.650Z",
    "currentExerciseEndsAt": "2026-09-21T12:01:00.250Z"
])
precondition(precise.countdownAnchor == running.sentAt.addingTimeInterval(0.25))
precondition(precise.remainingSeconds(at: running.sentAt.addingTimeInterval(1.249)) == 60)
precondition(precise.remainingSeconds(at: running.sentAt.addingTimeInterval(1.25)) == 59)
let pausedAfterTick = try decodeFixture([
    "revision": 3, "status": "paused", "sentAt": "2026-09-21T12:00:01.500Z",
    "currentExercise": ["name": "Current", "remainingSeconds": 59]
])
precondition(pausedAfterTick.remainingSeconds(at: delayedNow) == 59)
let resumed = try decodeFixture([
    "revision": 4, "sentAt": "2026-09-21T12:00:10.750Z",
    "currentExerciseEndsAt": "2026-09-21T12:01:09.750Z",
    "currentExercise": ["name": "Current", "remainingSeconds": 59]
])
precondition(resumed.countdownAnchor == running.sentAt.addingTimeInterval(10.75))
precondition(resumed.remainingSeconds(at: running.sentAt.addingTimeInterval(11.75)) == 58)
precondition(!pausedAfterTick.canReplace(resumed))
let restarted = try decodeFixture([
    "sessionId": "restarted", "revision": 1, "sentAt": "2026-09-21T12:00:20.125Z",
    "currentExerciseEndsAt": "2026-09-21T12:01:20.125Z"
])
precondition(restarted.canReplace(resumed))
precondition(!resumed.canReplace(restarted))
precondition(restarted.remainingSeconds(at: running.sentAt.addingTimeInterval(21.125)) == 59)
print("PASS: pause/resume and restart share phone tick boundaries and reject delayed old states")

let olderRevision = try decodeFixture(["revision": 1])
let olderTimestamp = try decodeFixture(["sentAt": "2026-09-21T11:59:59.000Z"])
precondition(!olderRevision.canReplace(running))
precondition(!olderTimestamp.canReplace(running))
precondition(duplicate.canReplace(running))
let newSession = try decodeFixture(["sessionId": "new-session", "revision": 0])
precondition(newSession.canReplace(running))
print("PASS: stale same-session updates are ignored and new sessions are accepted")

let wholeSeconds = try decodeFixture(["sentAt": "2026-09-21T12:00:00Z"])
precondition(wholeSeconds.sentAt == running.sentAt)
for invalid in [["sentAt": "invalid"], ["protocolVersion": 2]] as [[String: Any]] {
    do {
        _ = try decodeFixture(invalid)
        fatalError("Invalid state unexpectedly decoded")
    } catch is DecodingError {}
}
print("PASS: ISO timestamps accepted; malformed timestamps and unsupported versions rejected")

let theme: [String: Any] = [
    "accent": "#e07a9a", "background": "#fff6f9", "text": "#0f172a", "secondaryText": "#334155",
    "timerNormal": "#173c35", "timerWarning": "#8b5b13", "timerDanger": "#a42c40"
]
let themed = try decodeFixture(["appearance": theme])
precondition(themed.palette.accent == "#e07a9a")
precondition(themed.palette.background == "#fff6f9")
precondition(themed.timerColorHex(at: themed.sentAt.addingTimeInterval(38)) == "#173c35")
precondition(themed.timerColorHex(at: themed.sentAt.addingTimeInterval(39)) == "#8b5b13")
precondition(themed.timerColorHex(at: themed.sentAt.addingTimeInterval(50)) == "#8b5b13")
precondition(themed.timerColorHex(at: themed.sentAt.addingTimeInterval(51)) == "#a42c40")
let longExercise = try decodeFixture([
    "appearance": theme,
    "currentExercise": ["name": "Current", "remainingSeconds": 240, "durationSeconds": 240]
])
precondition(longExercise.timerColorHex(at: longExercise.sentAt.addingTimeInterval(156)) == "#8b5b13")
precondition(longExercise.timerColorHex(at: longExercise.sentAt.addingTimeInterval(204)) == "#a42c40")
precondition(running.palette.accent == WatchAppearance.fallback.accent)
let rgb = WatchAppearance.rgb("#e07a9a")
precondition(rgb.red == 224.0 / 255 && rgb.green == 122.0 / 255 && rgb.blue == 154.0 / 255)
print("PASS: phone palette decoded, RGB preserved, and warning/danger match 35%/15% thresholds")