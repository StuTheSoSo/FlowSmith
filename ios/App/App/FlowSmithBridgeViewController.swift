import Capacitor
import UIKit

class FlowSmithBridgeViewController: CAPBridgeViewController {
    override func setScreenOrientationDefaults() {
        supportedOrientations = [UIInterfaceOrientation.portrait.rawValue]
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WatchBridgePlugin())
    }
}
