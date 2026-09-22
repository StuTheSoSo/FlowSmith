//
//  ContentView.swift
//  FlowSmith Watch Watch App
//
//  Created by Stu Schwartz on 9/21/26.
//

import SwiftUI
import WatchConnectivity
import Combine

struct ContentView: View {
    @ObservedObject var session: WatchSessionStore

    var body: some View {
        ZStack {
            Color(watchHex: session.state?.palette.background ?? WatchAppearance.fallback.background)
                .ignoresSafeArea()

            if let state = session.state {
                TimelineView(.periodic(from: state.countdownAnchor, by: 1)) { context in
                    RunnerMirrorView(state: state, now: context.date)
                }
                .id(state.countdownAnchor)
            } else {
                WaitingForClassView(session: session)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .preferredColorScheme(.light)
        .task {
            session.activate()
        }
    }
}

private struct RunnerMirrorView: View {
    let state: WatchRunnerState
    let now: Date

    var body: some View {
        VStack(spacing: 5) {
            Spacer(minLength: 0)

            Text(remainingTime)
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.65)
                .lineLimit(1)
                .foregroundStyle(timerColor)

            Text(state.currentExercise?.name ?? "Class complete")
                .font(.headline)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)

            Spacer(minLength: 4)

            Divider()
                .overlay(Color(watchHex: state.palette.accent))

            VStack(spacing: 1) {
                Text("NEXT")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color(watchHex: state.palette.secondaryText))
                Text(state.nextExercise?.name ?? "Class complete")
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.72)
            }

                    Spacer(minLength: 4)

            HStack(spacing: 4) {
                Circle()
                    .fill(Color(watchHex: state.status == "running" ? state.palette.accent : state.palette.timerWarning))
                    .frame(width: 6, height: 6)
                Text("\(state.currentIndex + 1) of \(state.totalExercises)")
                    .font(.caption2)
                    .foregroundStyle(Color(watchHex: state.palette.secondaryText))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(Color(watchHex: state.palette.text))
    }

    private var remainingTime: String {
        let remaining = state.remainingSeconds(at: now)
        return String(format: "%02d:%02d", remaining / 60, remaining % 60)
    }

    private var timerColor: Color {
        Color(watchHex: state.timerColorHex(at: now))
    }
}

private extension Color {
    init(watchHex: String) {
        let components = WatchAppearance.rgb(watchHex)
        self.init(.sRGB, red: components.red, green: components.green, blue: components.blue, opacity: 1)
    }
}

private struct WaitingForClassView: View {
    @ObservedObject var session: WatchSessionStore

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Image(systemName: "timer")
                    .font(.title2)
                    .foregroundStyle(Color(watchHex: WatchAppearance.fallback.accent))
                Text("FlowSmith")
                    .font(.headline)
                Text(session.isReachable ? "Start a class on your iPhone" : "Open FlowSmith on your iPhone")
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                Divider().padding(.vertical, 2)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Supported: \(session.isSupportedText)")
                    Text("Activation: \(session.activationStateText)")
                    Text("Reachable: \(session.isReachable ? "yes" : "no")")
                    Text("Contexts received: \(session.contextReceivedCount)")
                    Text("Messages received: \(session.messageReceivedCount)")
                    if let lastPayloadType = session.lastPayloadType {
                        Text("Last payload type: \(lastPayloadType)")
                    }
                    if let error = session.lastError {
                        Text("Error: \(error)")
                            .foregroundStyle(.red)
                    }
                }
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}

@MainActor
final class WatchSessionStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var state: WatchRunnerState?
    @Published private(set) var isReachable = false
    @Published private(set) var activationStateText = "not activated"
    @Published private(set) var contextReceivedCount = 0
    @Published private(set) var messageReceivedCount = 0
    @Published private(set) var lastPayloadType: String?
    @Published private(set) var lastError: String?

    let isSupportedText = WCSession.isSupported() ? "yes" : "no"

    private let session = WCSession.default

    func activate() {
        guard WCSession.isSupported() else {
            activationStateText = "unsupported"
            return
        }
        session.delegate = self
        session.activate()
        isReachable = session.isReachable
        if !session.receivedApplicationContext.isEmpty {
            contextReceivedCount += 1
            apply(session.receivedApplicationContext)
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            switch activationState {
            case .activated: self.activationStateText = "activated"
            case .inactive: self.activationStateText = "inactive"
            case .notActivated: self.activationStateText = "notActivated"
            @unknown default: self.activationStateText = "unknown"
            }
            if let error {
                self.lastError = error.localizedDescription
            }
            self.isReachable = session.isReachable
            if !session.receivedApplicationContext.isEmpty {
                self.apply(session.receivedApplicationContext)
            }
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
        }
    }

    #if os(iOS)
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = false
        }
    }

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = false
        }
    }
    #endif

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            self.messageReceivedCount += 1
            self.apply(message)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            self.contextReceivedCount += 1
            self.apply(applicationContext)
        }
    }

    private func apply(_ payload: [String: Any]) {
        lastPayloadType = payload["type"] as? String ?? "(missing type)"
        guard payload["type"] as? String == "runner.state" else { return }
        guard JSONSerialization.isValidJSONObject(payload) else {
            lastError = "payload is not a valid JSON object"
            return
        }
        do {
            let data = try JSONSerialization.data(withJSONObject: payload)
            let nextState = try WatchRunnerState.decode(data)
            if let state, !nextState.canReplace(state) { return }
            state = nextState
            lastError = nil
        } catch {
            lastError = "decode failed: \(error)"
        }
    }
}
