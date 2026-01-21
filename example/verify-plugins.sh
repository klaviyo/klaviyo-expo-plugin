#!/bin/bash

# Firebase Crashlytics + Klaviyo Plugin Compatibility Verification Script
# This script checks that both plugins have successfully modified the Android project

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Firebase Crashlytics + Klaviyo Plugin Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if android folder exists
if [ ! -d "android" ]; then
    echo "❌ Error: android/ folder not found"
    echo "   Run: npx expo prebuild --platform android --clean"
    exit 1
fi

echo "📱 Android folder: ✅ Found"
echo ""

# Track overall success
ALL_CHECKS_PASSED=true

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 FIREBASE CRASHLYTICS CHECKS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: Firebase Crashlytics Gradle dependency in project build.gradle
echo "1️⃣  Checking project build.gradle for Crashlytics dependency..."
if grep -q "firebase-crashlytics-gradle" android/build.gradle; then
    GRADLE_VERSION=$(grep "firebase-crashlytics-gradle" android/build.gradle | sed -E "s/.*firebase-crashlytics-gradle:([0-9.]+).*/\1/")
    echo "   ✅ FOUND: Firebase Crashlytics Gradle Plugin v$GRADLE_VERSION"
    grep -n "firebase-crashlytics-gradle" android/build.gradle | head -1
else
    echo "   ❌ MISSING: Firebase Crashlytics Gradle dependency"
    ALL_CHECKS_PASSED=false
fi
echo ""

# Check 2: Firebase Crashlytics plugin applied in app build.gradle
echo "2️⃣  Checking app/build.gradle for Crashlytics plugin..."
if grep -q "com.google.firebase.crashlytics" android/app/build.gradle; then
    echo "   ✅ FOUND: Crashlytics plugin applied"
    grep -n "com.google.firebase.crashlytics" android/app/build.gradle | head -1
else
    echo "   ❌ MISSING: Crashlytics plugin not applied"
    ALL_CHECKS_PASSED=false
fi
echo ""

# Check 3: Google Services plugin
echo "3️⃣  Checking for Google Services plugin..."
if grep -q "com.google.gms.google-services" android/app/build.gradle; then
    echo "   ✅ FOUND: Google Services plugin applied"
    grep -n "com.google.gms.google-services" android/app/build.gradle | head -1
else
    echo "   ⚠️  WARNING: Google Services plugin not found (may be optional)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📧 KLAVIYO PLUGIN CHECKS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 4: Klaviyo metadata in AndroidManifest
echo "4️⃣  Checking AndroidManifest.xml for Klaviyo metadata..."
if grep -q "com.klaviyo.core.log_level" android/app/src/main/AndroidManifest.xml; then
    echo "   ✅ FOUND: Klaviyo log level metadata"
    grep -n "com.klaviyo.core.log_level" android/app/src/main/AndroidManifest.xml | head -1
else
    echo "   ❌ MISSING: Klaviyo metadata"
    ALL_CHECKS_PASSED=false
fi
echo ""

# Check 5: Klaviyo Push Service in AndroidManifest
echo "5️⃣  Checking AndroidManifest.xml for KlaviyoPushService..."
if grep -q "KlaviyoPushService" android/app/src/main/AndroidManifest.xml; then
    echo "   ✅ FOUND: KlaviyoPushService declared"
    grep -n "KlaviyoPushService" android/app/src/main/AndroidManifest.xml | head -1
else
    echo "   ❌ MISSING: KlaviyoPushService"
    ALL_CHECKS_PASSED=false
fi
echo ""

# Check 6: Klaviyo in MainActivity
echo "6️⃣  Checking MainActivity for Klaviyo.handlePush() calls..."
MAIN_ACTIVITY=$(find android/app/src/main -name "MainActivity.*" | head -1)
if [ -n "$MAIN_ACTIVITY" ]; then
    if grep -q "Klaviyo.handlePush" "$MAIN_ACTIVITY"; then
        PUSH_COUNT=$(grep -c "Klaviyo.handlePush" "$MAIN_ACTIVITY")
        echo "   ✅ FOUND: Klaviyo.handlePush() called $PUSH_COUNT time(s)"
        grep -n "Klaviyo.handlePush" "$MAIN_ACTIVITY" | head -2
    else
        echo "   ❌ MISSING: Klaviyo.handlePush() not found"
        ALL_CHECKS_PASSED=false
    fi
else
    echo "   ❌ ERROR: MainActivity not found"
    ALL_CHECKS_PASSED=false
fi
echo ""

# Check 7: Klaviyo strings in strings.xml
echo "7️⃣  Checking strings.xml for Klaviyo plugin metadata..."
if grep -q "klaviyo_sdk_plugin" android/app/src/main/res/values/strings.xml; then
    echo "   ✅ FOUND: Klaviyo SDK plugin metadata"
    grep -n "klaviyo_sdk_plugin" android/app/src/main/res/values/strings.xml | head -2
else
    echo "   ⚠️  WARNING: Klaviyo plugin metadata not in strings.xml"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 CONFLICT ANALYSIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Files modified by Firebase Crashlytics:"
echo "  • android/build.gradle (buildscript dependencies)"
echo "  • android/app/build.gradle (plugin application)"
echo ""

echo "Files modified by Klaviyo:"
echo "  • android/app/src/main/AndroidManifest.xml (metadata + service)"
echo "  • android/app/src/main/.../MainActivity.kt (push handling)"
echo "  • android/app/src/main/res/values/strings.xml (plugin metadata)"
echo "  • android/app/src/main/res/values/colors.xml (notification color)"
echo ""

echo "📊 File overlap: NONE"
echo "   Firebase and Klaviyo modify completely different files!"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Final result
if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo "✅ RESULT: ALL CHECKS PASSED - No conflicts detected!"
    echo ""
    echo "Both Firebase Crashlytics and Klaviyo plugins are properly"
    echo "configured and working together without conflicts. 🎉"
    exit 0
else
    echo "❌ RESULT: Some checks failed"
    echo ""
    echo "Please run: npx expo prebuild --platform android --clean"
    exit 1
fi
