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
        center.delegate = self
        #if canImport(KlaviyoLocation)
        KlaviyoSDK().registerGeofencing()
        #endif
        return true
    }

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void) {
        // Automatic push-open tracking is now owned by the Klaviyo Swift SDK (>= 5.4.0),
        // opt-in via the `klaviyo_automatic_push_open_tracking` Info.plist flag. We no longer
        // call `KlaviyoSDK().handle(...)` here — this delegate remains solely to preserve
        // expo-notifications compatibility by forwarding to the original delegate.
        let didReceiveSelector = #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))
        if let originalDelegate, originalDelegate.responds(to: didReceiveSelector) {
            originalDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else {
            // No downstream handler will call it, so honor the completion contract here.
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
