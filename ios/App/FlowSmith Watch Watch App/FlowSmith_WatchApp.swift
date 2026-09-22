//
//  FlowSmith_WatchApp.swift
//  FlowSmith Watch Watch App
//
//  Created by Stu Schwartz on 9/21/26.
//

import SwiftUI

@main
struct FlowSmith_Watch_Watch_AppApp: App {
    @StateObject private var session = WatchSessionStore()

    var body: some Scene {
        WindowGroup {
            ContentView(session: session)
        }
    }
}
