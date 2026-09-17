require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoKlaviyo'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = 'https://github.com/klaviyo/klaviyo-expo-plugin'
  # This pod's OWN floor, not the app's. 15.1 tracks ExpoModulesCore, which this pod depends
  # on: expo-modules-core declares :ios => '15.1' on Expo SDK 54 and 55 (and 16.4 from 56).
  # NOT KlaviyoSwift - that declares 13.0 on every 5.x release, so it is not the binding
  # constraint. The previous value of '12' was below what ExpoModulesCore already forced.
  #
  # It is deliberately NOT 16.4. README and AGENTS.md quote 16.4 because expo-modules-core
  # raised the *app* deployment target in Expo SDK 56, and expo-modules-autolinking lifts
  # this pod to match via reconcile_expo_module_deployment_targets. Both numbers are
  # correct at their own level: 16.4 is the effective app floor on SDK 56+, 15.1 is the
  # lowest target this pod can be built against on its own. Do not "fix" one to match
  # the other - raising this to 16.4 would drop SDK 54/55 consumers, whose app floor is 15.1.
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5'
  s.source         = { git: 'https://github.com/klaviyo/klaviyo-expo-plugin.git', tag: s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'React-Core'
  # Deliberately unversioned. klaviyo-react-native-sdk pins KlaviyoSwift to an exact
  # version per release, so it governs resolution wherever it is present. A range here
  # adds nothing on that path and becomes a hard `pod install` failure the moment the
  # companion SDK pins a major this range excludes.
  s.dependency 'KlaviyoSwift'

  # Conditional location dependency based on environment variable
  # Default is FALSE (opt-in for geofencing)
  include_location = ENV['KLAVIYO_INCLUDE_LOCATION'] == 'true'
  if include_location
    s.dependency 'KlaviyoLocation'
  end

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  if !$ExpoUseSources&.include?(package['name']) && ENV['EXPO_USE_SOURCE'].to_i == 0 && File.exist?("#{s.name}.xcframework") && Gem::Version.new(Pod::VERSION) >= Gem::Version.new('1.10.0')
    s.source_files = "#{s.name}/**/*.h"
    s.vendored_frameworks = "#{s.name}.xcframework"
  else
    s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  end
end
