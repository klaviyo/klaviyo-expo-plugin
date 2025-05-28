require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoKlaviyo'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = 'A React Native module for integrating Klaviyo SDK into Expo applications. Provides push notification support and analytics tracking capabilities.'
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = 'https://github.com/klaviyo/klaviyo-expo-plugin'
  s.platforms      = {
    :ios => '12'
  }
  s.swift_version  = '5'
  s.source         = { git: 'https://github.com/klaviyo/klaviyo-expo-plugin.git', tag: s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'React-Core'
  s.dependency 'KlaviyoSwift'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    # 'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  if !$ExpoUseSources&.include?(package['name']) && ENV['EXPO_USE_SOURCE'].to_i == 0 && File.exist?("#{s.name}.xcframework") && Gem::Version.new(Pod::VERSION) >= Gem::Version.new('1.10.0')
    s.source_files = "#{s.name}/**/*.h"
    s.vendored_frameworks = "#{s.name}.xcframework"
  else
    s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  end
end
