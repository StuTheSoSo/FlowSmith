import Foundation

struct WatchRunnerState: Decodable {
    let protocolVersion: Int
    let sessionId: String
    let revision: Int
    let sentAt: Date
    let currentExerciseEndsAt: Date?
    let status: String
    let currentIndex: Int
    let totalExercises: Int
    let currentExercise: WatchExercise?
    let nextExercise: WatchExercise?
    let appearance: WatchAppearance?

    var palette: WatchAppearance { appearance ?? .fallback }

    var controlCommand: String? {
        switch status {
        case "ready", "setup": return "start"
        case "running": return "pause"
        case "paused": return "resume"
        default: return nil
        }
    }

    var controlTitle: String {
        switch status {
        case "running": return "Pause"
        case "paused": return "Resume"
        default: return "Go"
        }
    }

    func commandPayload(messageId: String, now: Date, command requestedCommand: String? = nil) -> [String: Any]? {
        guard let command = requestedCommand ?? controlCommand,
              command == controlCommand || (command == "stop" && controlCommand != nil) else { return nil }
        return [
            "type": "runner.command", "protocolVersion": protocolVersion,
            "sessionId": sessionId, "messageId": messageId,
            "sentAt": ISO8601DateFormatter().string(from: now),
            "command": command, "baseRevision": revision
        ]
    }

    func timerColorHex(at now: Date) -> String {
        guard let duration = currentExercise?.durationSeconds, duration > 0 else { return palette.timerNormal }
        let percent = Double(remainingSeconds(at: now)) / Double(duration) * 100
        if percent <= 15 { return palette.timerDanger }
        if percent <= 35 { return palette.timerWarning }
        return palette.timerNormal
    }

    static func decode(_ data: Data) throws -> WatchRunnerState {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let timestamp = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: timestamp) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: timestamp) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid state timestamp")
        }
        let state = try decoder.decode(Self.self, from: data)
        guard state.protocolVersion == 1 else {
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Unsupported watch protocol"))
        }
        return state
    }

    func remainingSeconds(at now: Date) -> Int {
        let remaining = max(0, currentExercise?.remainingSeconds ?? 0)
        guard status == "running" else { return remaining }
        if let currentExerciseEndsAt {
            let milliseconds = (currentExerciseEndsAt.timeIntervalSince1970 * 1000).rounded()
                - (now.timeIntervalSince1970 * 1000).rounded()
            return Int(min(Double(remaining), max(0, ceil(milliseconds / 1000))))
        }
        let elapsed = min(Double(remaining), max(0, now.timeIntervalSince(sentAt)))
        return remaining - Int(elapsed)
    }

    var countdownAnchor: Date {
        guard status == "running", let currentExerciseEndsAt else { return sentAt }
        return currentExerciseEndsAt.addingTimeInterval(-Double(currentExercise?.remainingSeconds ?? 0))
    }

    func canReplace(_ previous: WatchRunnerState) -> Bool {
        guard sentAt >= previous.sentAt else { return false }
        guard sessionId == previous.sessionId else { return true }
        return revision >= previous.revision
    }
}

struct WatchExercise: Decodable {
    let name: String
    let remainingSeconds: Int?
    let durationSeconds: Int?
}

struct WatchAppearance: Decodable {
    let accent: String
    let background: String
    let text: String
    let secondaryText: String
    let timerNormal: String
    let timerWarning: String
    let timerDanger: String

    static let fallback = WatchAppearance(
        accent: "#2a8fa5", background: "#f3fbfd", text: "#0f172a", secondaryText: "#334155",
        timerNormal: "#173c35", timerWarning: "#8b5b13", timerDanger: "#a42c40"
    )

    static func rgb(_ hex: String) -> (red: Double, green: Double, blue: Double) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        let value = digits.count == 6 ? UInt32(digits, radix: 16) ?? 0 : 0
        return (Double((value >> 16) & 255) / 255, Double((value >> 8) & 255) / 255, Double(value & 255) / 255)
    }
}