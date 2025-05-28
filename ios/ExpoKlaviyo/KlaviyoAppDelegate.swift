import ExpoModulesCore
import KlaviyoSwift

public final class KlaviyoAppDelegate: ExpoAppDelegateSubscriber, UNUserNotificationCenterDelegate {
    public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void) {
        let handled = KlaviyoSDK().handle(notificationResponse: response, withCompletionHandler: completionHandler)
        if !handled {
            completionHandler()
        }
    }
    
    public override func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return RCTLinkingManager.application(app, open: url, options: options)
    }

}
