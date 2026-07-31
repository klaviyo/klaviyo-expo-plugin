import ExpoModulesCore
import KlaviyoSwift

#if canImport(KlaviyoLocation)
@_spi(KlaviyoPrivate) import KlaviyoLocation
#endif

public final class KlaviyoAppDelegate: ExpoAppDelegateSubscriber, UNUserNotificationCenterDelegate {

    private weak var originalDelegate: UNUserNotificationCenterDelegate?

    // True when the `ios.automaticPushOpenTracking` plugin prop is set, meaning the native
    // Klaviyo SDK (≥ 5.4.0) owns push-open tracking via its own delegate proxy. When false
    // (the default), this delegate is responsible for calling handle(notificationResponse:).
    private var isAutomaticPushOpenTrackingEnabled: Bool {
        Bundle.main.object(forInfoDictionaryKey: "klaviyo_automatic_push_open_tracking") as? Bool ?? false
    }

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
        // When automatic push-open tracking is enabled, KlaviyoNotificationDelegate (native
        // SDK ≥ 5.4.0) owns tracking. Skip the manual call so there is no duplicate event,
        // even in the case where this delegate sits between KlaviyoNotificationDelegate and
        // expo-notifications in the forwarding chain.
        let handledByKlaviyo: Bool
        if !isAutomaticPushOpenTrackingEnabled {
            handledByKlaviyo = KlaviyoSDK().handle(notificationResponse: response, withCompletionHandler: completionHandler)
        } else {
            handledByKlaviyo = false
        }

        let didReceiveSelector = #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))
        if let originalDelegate, originalDelegate.responds(to: didReceiveSelector) {
            // If Klaviyo already consumed the completion handler, forward with a no-op so
            // expo-notifications can still observe the response (firing any JS listeners)
            // without invoking the real handler a second time.
            let downstream: () -> Void = handledByKlaviyo ? {} : completionHandler
            originalDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: downstream)
        } else if !handledByKlaviyo {
            // No downstream handler and Klaviyo didn't consume the completion.
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
