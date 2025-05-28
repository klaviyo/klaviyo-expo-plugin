import ExpoModulesCore
import KlaviyoSwift

public final class KlaviyoAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    return true
  }

  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
  }

  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
  }

  public func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
  }
    
    public func applicationDidBecomeActive(_ application: UIApplication) {
    }

    public func applicationWillResignActive(_ application: UIApplication) {
    }

    public func applicationDidEnterBackground(_ application: UIApplication) {
    }

    public func applicationWillEnterForeground(_ application: UIApplication) {
    }

    public func applicationWillTerminate(_ application: UIApplication) {
    }
}
