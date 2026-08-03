import ExpoModulesCore
import KlaviyoSwift

#if canImport(KlaviyoLocation)
@_spi(KlaviyoPrivate) import KlaviyoLocation
#endif

public final class KlaviyoAppDelegate: ExpoAppDelegateSubscriber, UNUserNotificationCenterDelegate {

    private weak var originalDelegate: UNUserNotificationCenterDelegate?

    public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        // Store the original delegate so we can forward to expo-notifications' handlers.
        let center = UNUserNotificationCenter.current()
        originalDelegate = center.delegate
        // Allow Klaviyo to intercept notifications
        center.delegate = self
        #if canImport(KlaviyoLocation)
        KlaviyoSDK().registerGeofencing()
        #endif
        return true
    }

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let handled = KlaviyoSDK().handle(notificationResponse: response, withCompletionHandler: completionHandler)

        let didReceiveSelector = #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))
        if let originalDelegate, originalDelegate.responds(to: didReceiveSelector) {
            // If handle() already consumed the completionHandler, forward with a no-op so
            // expo-notifications can still observe the response (firing any JS listeners)
            // without invoking the real handler a second time.
            let downstream: () -> Void = handled ? {} : completionHandler
            originalDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: downstream)
        } else if !handled {
            // No downstream handler and the completionHandler hasn't been consumed yet.
            completionHandler()
        }
    }

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Forward to the original delegate (for expo-notifications)
        let willPresentSelector = #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))
        if let originalDelegate, originalDelegate.responds(to: willPresentSelector) {
            originalDelegate.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            completionHandler([.list, .banner, .badge, .sound])
        }
    }
}
