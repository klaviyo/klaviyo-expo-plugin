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
}
