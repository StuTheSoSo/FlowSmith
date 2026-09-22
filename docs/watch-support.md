# FlowSmith Watch Support

## Goal

Add companion-watch support for the FlowSmith class runner so an instructor can see the active exercise and control the timer from an Apple Watch or Wear OS watch while the phone remains the primary planner and data store.

The first release should be a **phone-dependent companion experience**. The watch should not reproduce the Planner, exercise library, grading, settings, or full class editor.

## Current Project Baseline

- App: Ionic Angular 8.8.3 with Capacitor 8.x.
- Web framework: Angular 21.2.x.
- Native bundle ID: `com.stuschwartz.flowsmith`.
- iOS native target: iOS 15.0, Swift 5, iPhone and iPad families.
- Android native target: min SDK 24, compile/target SDK 36.
- Existing Capacitor plugins: Preferences and Screen Orientation.
- Existing native targets: one iOS application target and one Android application module.
- No Apple Watch target, watchOS extension, Wear OS module, or watch communication layer exists yet.
- Main timer owner: `src/app/class-runner.service.ts`.
- Current timer implementation: persisted `BehaviorSubject` state with timestamp-based reconciliation; the one-second JavaScript interval refreshes the UI but does not own elapsed time.
- Current state includes source, cloned plan, flattened exercises, current index, current exercise elapsed seconds, total elapsed seconds, status, and optional completed exercise ID.
- Plan, runner settings, and the active runner snapshot use local storage. A restored active run pauses and asks the instructor to resume or discard it.
- Phone UI entry point: `src/app/run/run.page.ts` and `src/app/run/run.page.html`.

## Product Scope

### Watch MVP

Display:

- Current exercise name.
- Current exercise remaining time.
- Next exercise name.
- Optional class progress, such as `2 of 7`.
- Connection/synchronization status.

Controls:

- Pause.
- Resume.
- Next exercise.
- Previous exercise.
- Stop class, with confirmation.

Optional MVP behavior:

- Haptic notification when an exercise ends.
- Haptic notification when the watch reconnects or loses connection.
- Keep the watch screen readable during an active class where the platform permits it.

### Explicitly out of scope for MVP

- Editing or creating plans on the watch.
- Exercise search or library browsing.
- Safety-condition editing.
- Full exercise instructions and long teaching notes.
- Account/authentication work.
- Standalone watch operation after the phone is unavailable.
- Complications, tiles, widgets, or watch-face integrations. These can follow after the companion flow is stable.

## Architecture Decision

The phone remains the source of truth for:

- The selected plan.
- The flattened exercise list.
- Timer progression.
- Runner settings.
- Completion state.

The watch is a remote display and control surface. Commands travel from watch to phone; authoritative state travels from phone to watch.

Do not make the watch depend on the Angular `setInterval` being alive. The phone timer must become timestamp-based and recoverable from lifecycle interruptions.

## Phase 1: Make the Phone Timer Durable

**Status: complete.** The runner persists a versioned snapshot, reconciles elapsed time from timestamps, handles native app lifecycle changes, pauses restored active sessions for instructor confirmation, clears snapshots on completion or stop, and has focused Jasmine coverage.

Refactor `ClassRunnerService` before adding either watch target.

### State model

Add a versioned, serializable runner snapshot. Suggested shape:

```ts
interface RunnerSnapshot {
  version: 1;
  sessionId: string;
  source: ClassRunSource;
  planId: string;
  planName: string;
  exercises: RunExercise[];
  currentIndex: number;
  status: 'ready' | 'running' | 'paused' | 'completed';
  elapsedSeconds: number;
  currentExerciseElapsedSeconds: number;
  startedAt?: string;
  pausedAt?: string;
  updatedAt: string;
  completedExerciseId?: string;
}
```

The exact model can remain compatible with `ClassRunState`, but it must contain enough information to reconstruct time from timestamps.

### Timer rules

- On start or resume, record `startedAt` and the timestamp from which elapsed time is calculated.
- On pause, calculate elapsed time once, clear the active timestamp, then persist the snapshot.
- On every state-changing command, persist the snapshot and emit the new state.
- On app foreground/resume, recalculate from timestamps rather than assuming one tick per second.
- On app background, do not rely on JavaScript timers continuing to execute.
- Preserve the current `sessionId` for the duration of a run.
- Clear the snapshot on explicit stop or after the class is completed, according to the desired resume policy.
- Keep the existing one-second interval only for UI refresh; it must not be the authoritative clock.

### Persistence API

Prefer a small runner persistence abstraction rather than direct local-storage calls inside every timer method.

Suggested methods:

```ts
interface RunnerPersistence {
  load(): Promise<RunnerSnapshot | null>;
  save(snapshot: RunnerSnapshot): Promise<void>;
  clear(): Promise<void>;
}
```

The web implementation may use local storage initially. Native implementations may use Capacitor Preferences if needed.

### Phone lifecycle

Add app lifecycle handling using Capacitor App events:

- `appStateChange`: persist and recalculate when moving between active/inactive states.
- `resume`: restore and emit current state.
- Route leave: pause or preserve the current product behavior deliberately; do not silently lose a running class.
- App termination/relaunch: offer to resume a valid snapshot.

Add tests for backgrounding across an exercise boundary and for a relaunch with a running snapshot.

## Phase 2: Define the Watch Protocol

**Status: complete.** The shared TypeScript contract and `WatchProtocolService` now publish compact versioned runner state, validate commands, acknowledge accepted or rejected requests, and reject duplicate, stale, and unknown-session commands. Native delivery is deferred to Phase 3.

Create a shared protocol document and TypeScript types for the phone bridge.

Every message should include:

- `protocolVersion`.
- `sessionId`.
- `messageId`.
- `sentAt`.
- `revision` for state messages.

### Phone to watch state message

Example:

```json
{
  "type": "runner.state",
  "protocolVersion": 1,
  "sessionId": "run-uuid",
  "revision": 42,
  "sentAt": "2026-09-18T19:00:00.000Z",
  "status": "running",
  "currentIndex": 1,
  "totalExercises": 7,
  "currentExercise": {
    "id": "flow-item-id",
    "name": "Pelvic Curl",
    "remainingSeconds": 235,
    "durationSeconds": 300
  },
  "nextExercise": {
    "id": "next-flow-item-id",
    "name": "The Hundred"
  },
  "className": "Morning Mobility",
  "updatedAt": "2026-09-18T19:00:00.000Z"
}
```

The watch should receive short localized display strings or stable IDs plus enough data to render immediately. Do not send the entire exercise database.

### Watch to phone command message

Example:

```json
{
  "type": "runner.command",
  "protocolVersion": 1,
  "sessionId": "run-uuid",
  "messageId": "command-uuid",
  "command": "pause",
  "sentAt": "2026-09-18T19:00:04.000Z"
}
```

Supported commands:

- `start`
- `pause`
- `resume`
- `next`
- `previous`
- `stop`
- `requestState`

### Acknowledgements and conflicts

The phone must acknowledge commands with success or a reason for rejection:

```json
{
  "type": "runner.commandAck",
  "protocolVersion": 1,
  "sessionId": "run-uuid",
  "messageId": "command-uuid",
  "accepted": true,
  "revision": 43,
  "sentAt": "2026-09-18T19:00:04.100Z"
}
```

Rules:

- Commands are idempotent where possible.
- Prevent duplicate command application with a command ID or monotonic revision.
- A stale command must not move the phone backward unexpectedly.
- If the session ID is unknown, reject the command and send the latest state.
- If the watch reconnects, it requests the latest state instead of replaying old commands.
- The watch treats the phone state as authoritative after every acknowledgement.

## Phase 3: Native Bridge from Capacitor

**Status: implemented; native device-build validation pending.** `WatchBridgeService` is initialized once at app startup. The iOS phone app uses `WatchConnectivity` and the Android phone app uses the Wear OS Data Layer to retain latest state, relay commands, send acknowledgements, and emit connection changes. Native compilation requires accepting the local Xcode license and installing a Java runtime before device validation can run.

Create a Capacitor plugin or native bridge owned by the project. A plugin is preferable to trying to expose watch communication through arbitrary WebView JavaScript.

Suggested web API:

```ts
interface WatchBridge {
  isAvailable(): Promise<{ available: boolean; paired: boolean }>;
  sendState(state: WatchStateMessage): Promise<void>;
  addListener(event: 'command', listener: (command: WatchCommandMessage) => void): Promise<PluginListenerHandle>;
  addListener(event: 'connectionChanged', listener: (event: WatchConnectionEvent) => void): Promise<PluginListenerHandle>;
  requestState(): Promise<void>;
}
```

Responsibilities:

- Serialize and validate messages.
- Queue the latest state while the watch is unreachable.
- Deliver the latest state after reconnection.
- Surface connection status to the Angular Run page.
- Remove listeners when the Run page or app service is destroyed.
- Avoid sending the entire plan or personal data unnecessarily.

The Angular integration should live in a dedicated service, for example `WatchBridgeService`, rather than in `ClassRunnerService` or `RunPage`.

## Apple Watch Implementation

### Native project work

1. Open the iOS project in Xcode.
2. Add a watchOS App target, for example `FlowSmith Watch`.
3. Choose SwiftUI for the watch interface.
4. Add the watch target to the iOS app scheme and archive configuration.
5. Create distinct bundle identifiers for the watch app and its extension as required by the selected Xcode template.
6. Configure automatic signing and the same Apple Developer team as the phone app.
7. Set the minimum watchOS deployment target deliberately and verify it against the supported phone iOS target.
8. Add watch app icons and launch assets.
9. Include the watch target in the App Store archive and TestFlight build.

### Communication

Use `WatchConnectivity`:

- `WCSession` activation in both the phone and watch processes.
- `sendMessage` for immediate commands when both sides are reachable.
- `updateApplicationContext` for the latest runner state so reconnecting devices receive the newest snapshot.
- `transferUserInfo` only for queued events that must eventually arrive; do not queue every timer tick.
- Reachability and activation state surfaced to the Capacitor bridge.
- State restoration on watch launch and phone relaunch.

The phone-side `WCSessionDelegate` should forward validated watch commands into `WatchBridgeService`. The watch-side delegate should publish incoming state to the SwiftUI model.

### Apple Watch UI

Use a high-contrast, glanceable layout:

- Large monospaced/tabular countdown.
- Current exercise as the primary label.
- Next exercise as secondary text.
- Large Pause/Resume control.
- Swipe or secondary controls for previous/next.
- Connection indicator that does not obscure the timer.

The watch must not assume that a phone WebView is currently visible.

## Wear OS Implementation

### Native project work

1. Add a Wear OS module to the Android project in Android Studio.
2. Use Kotlin and Jetpack Compose for Wear OS.
3. Configure the Wear module’s namespace, application ID, compile SDK, min SDK, signing, and release variant.
4. Add Wear OS app icons and preview/device resources.
5. Add the Wear module to the Gradle settings and build configuration.
6. Configure Play Console packaging and listing for the watch experience.
7. Decide whether the watch is phone-dependent only or also eligible for standalone distribution. MVP should be phone-dependent.

### Communication

Use the Wear OS Data Layer API:

- `MessageClient` for immediate watch commands.
- `DataClient` with a latest-state data item for synchronization and reconnection.
- A service or lifecycle-aware component to receive messages while the UI is not visible.
- Capability discovery so the phone knows whether the FlowSmith watch app is installed and reachable.
- Do not send one Data Layer update per second; send state changes and let the watch derive the countdown from timestamps.

The Android phone side must bridge Data Layer commands into `WatchBridgeService`. The Wear module must send commands with session ID, message ID, and protocol version.

### Wear OS UI

Use Compose for Wear OS and support round and rectangular screens:

- Large tabular countdown.
- Current and next exercise labels.
- Pause/Resume as the primary action.
- Next and previous actions available without navigating through a complex menu.
- Connection and stale-state indicators.
- Haptic feedback where supported.

## Shared Timing and Display Rules

- The phone and watch derive remaining time from an authoritative timestamp and duration.
- A watch must never drift simply because its display refresh is throttled.
- Send state at start, pause, resume, exercise change, stop, completion, reconnect, and explicit state request.
- A watch may locally refresh the displayed countdown once per second, but it must recalculate from the last received timestamp.
- When the phone is unreachable, show the last known state as stale and disable or queue controls according to the platform behavior.
- When the watch reconnects, request and apply a fresh state before enabling controls.
- Long localized exercise names must truncate or wrap predictably on the watch; never make the countdown unreadable.
- Do not send sensitive client notes, safety conditions, or personal information in watch messages for MVP.

## Angular Integration Plan

Create:

- `src/app/watch/watch-bridge.service.ts`
- `src/app/watch/watch-protocol.ts`
- `src/app/watch/watch-connection.model.ts` or equivalent types
- Native Capacitor implementation under the iOS and Android Capacitor plugin targets

`WatchBridgeService` should:

1. Subscribe once to `ClassRunnerService.state$` at the app/service boundary.
2. Map `ClassRunState` to the compact `WatchStateMessage`.
3. Deduplicate identical state revisions.
4. Send state only when meaningful state changes occur.
5. Expose connection status to `RunPage`.
6. Route incoming commands to `ClassRunnerService`.
7. Request state after bridge activation or reconnection.
8. Stop sending state when no class session is active.

Add a small connection indicator to the normal Run page. The focused teaching view can show only a discreet connection status if needed, but it must not compete with the timer.

## Testing Plan

### Unit tests

- Runner snapshot serialization and restoration.
- Timestamp-based elapsed and remaining time calculations.
- Pause/resume around app backgrounding.
- Exercise boundary and completion behavior.
- Command validation and unsupported command rejection.
- Duplicate command IDs.
- Stale revision/session handling.
- Mapping from `ClassRunState` to the compact watch state.
- Reconnection sends the latest state only.

### iOS tests

- `WCSession` activation on phone and watch.
- Immediate command while reachable.
- Context update while unreachable, then reconnect.
- Watch launch while phone is asleep.
- Phone relaunch with an active session.
- Watch app termination and relaunch.
- Haptics and timer readability on supported Apple Watch sizes.
- TestFlight installation and archive contains the watch target.

### Wear OS tests

- Capability discovery with watch app installed/uninstalled.
- Message and Data Layer delivery while reachable.
- Reconnection and latest-state replacement.
- Phone and watch process restarts.
- Round and rectangular screen layouts.
- Different font sizes and long localized exercise names.
- Play internal testing build includes the Wear module.

### End-to-end matrix

Test at minimum:

- Phone active, watch active.
- Phone locked, watch active.
- Phone backgrounded, watch command sent.
- Watch disconnected during a class.
- Reconnection after an exercise boundary.
- Pause from phone, then resume from watch.
- Next from watch, then previous from phone.
- Stop from either device.
- Completion from either device.
- App termination and resume.
- English plus at least one long-string locale.

## Release and Account Requirements

### Apple

- Apple Developer Program membership.
- Xcode and a macOS build environment.
- App ID/capabilities for the iPhone app and watch app.
- Watch provisioning and signing.
- App Store Connect watch metadata and screenshots.
- TestFlight testing on a real paired iPhone and Apple Watch.

### Android

- Android Studio with Wear OS tooling.
- Google Play Console developer account.
- Signed phone and Wear OS release artifacts.
- Wear OS listing/configuration and screenshots.
- Internal testing on at least one physical Wear OS watch.

### Hardware

Browser testing cannot verify watch connectivity, background delivery, haptics, or native timer behavior. Real-device testing is required for both platforms.

## Suggested Delivery Order

1. Add timestamp-based durable runner state and lifecycle recovery.
2. Add protocol types, command validation, and Angular `WatchBridgeService` with a no-op/web implementation.
3. Add iOS Capacitor bridge and Apple Watch target.
4. Test Apple Watch companion flow through TestFlight.
5. Add Android Capacitor bridge and Wear OS module.
6. Test Wear OS companion flow through Play internal testing.
7. Add connection indicators, haptics, and polish.
8. Consider complications, tiles, widgets, or standalone mode only after the companion flow is reliable.

## Definition of Done for Watch MVP

- A class started on the phone appears on the paired watch within a reasonable connection interval.
- The watch displays the correct current and next exercises and a timestamp-correct countdown.
- Pause, resume, next, previous, and stop commands work from both watch platforms.
- Reconnection converges on the phone’s latest state without duplicating or reversing commands.
- Phone backgrounding and relaunch do not reset or materially drift the class timer.
- The watch UI remains usable on small round and rectangular screens.
- Native signing, archive, TestFlight, and Play internal testing builds succeed.
- No Planner, client notes, safety data, or unnecessary personal data is transmitted to the watch.
