import ExpoModulesCore
import KlaviyoSwift

public final class KlaviyoAppDelegate: ExpoAppDelegateSubscriber, UNUserNotificationCenterDelegate {
    
    private var originalDelegate: UNUserNotificationCenterDelegate?
    
    public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        // Store the original delegate (for expo-notifications)
        let center = UNUserNotificationCenter.current()
        originalDelegate = center.delegate
        
        // Set self for Klaviyo SDK to intercept notifications
        center.delegate = self
        return true
    }
    
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void) {
        
        // Handle with Klaviyo SDK first
        let klaviyoHandled = KlaviyoSDK().handle(notificationResponse: response, withCompletionHandler: completionHandler)
        
        // Also forward to the original delegate (expo-notifications) if it exists
        if let originalDelegate {
            originalDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else if !klaviyoHandled {
            completionHandler()
        }
    }
    
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Forward to the original delegate (for expo-notifications) first
        if let originalDelegate {
            originalDelegate.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            // Fallback: show notification in foreground
            completionHandler([.list, .banner, .badge, .sound])
        }
    }
}
