import ExpoModulesCore
import KlaviyoSwift

#if canImport(KlaviyoLocation)
@_spi(KlaviyoPrivate) import KlaviyoLocation
#endif

public final class KlaviyoAppDelegate: ExpoAppDelegateSubscriber, UNUserNotificationCenterDelegate {

    private weak var originalDelegate: UNUserNotificationCenterDelegate?

    public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        // Store the original delegate in order to call expo-notifications handlers
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
        withCompletionHandler completionHandler: @escaping () -> Void) {
        _ = KlaviyoSDK().handle(notificationResponse: response, withCompletionHandler: completionHandler)
        if let originalDelegate {
            originalDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        }
    }

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Forward to the original delegate (for expo-notifications)
        if let originalDelegate {
            originalDelegate.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            completionHandler([.list, .banner, .badge, .sound])
        }
    }
    
    /// Forwards the APNs device token to Klaviyo when automatic push token forwarding is enabled.
    ///
    /// Expo delivers `didRegisterForRemoteNotificationsWithDeviceToken` to every registered
    /// `ExpoAppDelegateSubscriber`, so handling it here gives deterministic token forwarding that
    /// coexists with expo-notifications' own subscriber.
    ///
    /// This is used in place of KlaviyoSwift's app-delegate swizzling
    /// (`klaviyo_automatic_push_token_forwarding`): in a config-plugin setup the swizzle is only
    /// installed from `KlaviyoSDK.initialize(with:)`, which runs from JS after launch, so the
    /// APNs callback can fire before the swizzle exists and the token is missed. The subscriber
    /// is registered at build time and is therefore always in the delivery path.
    ///
    /// Gated on the same `klaviyo_automatic_push_token_forwarding` Info.plist key the plugin
    /// injects from the `automaticPushTokenForwarding` prop, so the opt-in stays authoritative.
    public func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let forwardingEnabled = Bundle.main.object(
            forInfoDictionaryKey: "klaviyo_automatic_push_token_forwarding"
        ) as? Bool ?? false
        guard forwardingEnabled else { return }
        KlaviyoSDK().set(pushToken: deviceToken)
    }
}
