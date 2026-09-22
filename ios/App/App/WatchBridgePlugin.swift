import Capacitor
import WatchConnectivity

@objc(WatchBridgePlugin)
class WatchBridgePlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    let identifier = "WatchBridgePlugin"
    let jsName = "WatchBridge"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendAcknowledgement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestState", returnType: CAPPluginReturnPromise)
    ]

    private var session: WCSession? {
        WCSession.isSupported() ? WCSession.default : nil
    }

    private var pendingState: [String: Any]?

    override func load() {
        guard let session else { return }
        session.delegate = self
        session.activate()
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(connectionState())
    }

    @objc func sendState(_ call: CAPPluginCall) {
        guard let state = call.getObject("state") else {
            call.reject("A runner state message is required.")
            return
        }
        guard let session else {
            call.reject("WatchConnectivity is unavailable on this device.")
            return
        }

        pendingState = state
        if let error = deliverPendingState(using: session) {
            call.reject("Watch state delivery failed: \(error.localizedDescription)")
        } else {
            call.resolve()
        }
    }

    @discardableResult
    private func deliverPendingState(using session: WCSession) -> Error? {
        guard let state = pendingState else { return nil }
        guard session.activationState == .activated else {
            NSLog("[FlowSmith WatchBridge] State buffered until session activation")
            session.activate()
            return nil
        }

        if session.isReachable {
            session.sendMessage(state, replyHandler: nil) { error in
                NSLog("[FlowSmith WatchBridge] Live state delivery failed: %@", error.localizedDescription)
            }
        }
        do {
            try session.updateApplicationContext(state)
            NSLog("[FlowSmith WatchBridge] State submitted; paired=%d installed=%d reachable=%d",
                  session.isPaired, session.isWatchAppInstalled, session.isReachable)
            return nil
        } catch {
            NSLog("[FlowSmith WatchBridge] Application context update failed: %@", error.localizedDescription)
            return error
        }
    }

    @objc func sendAcknowledgement(_ call: CAPPluginCall) {
        guard let acknowledgement = call.getObject("acknowledgement") else {
            call.reject("A command acknowledgement is required.")
            return
        }
        guard let session else {
            call.reject("WatchConnectivity is unavailable on this device.")
            return
        }

        if session.isReachable {
            session.sendMessage(acknowledgement, replyHandler: nil) { error in
                NSLog("[FlowSmith WatchBridge] Acknowledgement delivery failed: %@", error.localizedDescription)
            }
        }
        call.resolve()
    }

    @objc func requestState(_ call: CAPPluginCall) {
        notifyListeners("connectionChanged", data: connectionState())
        call.resolve()
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error {
            NSLog("[FlowSmith WatchBridge] Activation failed: %@", error.localizedDescription)
            return
        }
        guard activationState == .activated else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.deliverPendingState(using: session)
            self.notifyListeners("connectionChanged", data: self.connectionState())
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("connectionChanged", data: self?.connectionState() ?? [:])
        }
    }

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.deliverPendingState(using: session)
            self.notifyListeners("connectionChanged", data: self.connectionState())
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        forwardCommand(message)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        forwardCommand(applicationContext)
    }

    private func forwardCommand(_ message: [String: Any]) {
        guard message["type"] as? String == "runner.command" else { return }
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("command", data: message, retainUntilConsumed: true)
        }
    }

    private func connectionState() -> JSObject {
        guard let session else {
            return ["available": false, "paired": false, "reachable": false]
        }
        return [
            "available": true,
            "paired": session.isPaired && session.isWatchAppInstalled,
            "reachable": session.isReachable
        ]
    }
}
