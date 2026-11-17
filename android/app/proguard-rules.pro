# Capacitor bridge — JS ↔ native কল reflection দিয়ে হয়, তাই মুছে ফেলা যাবে না
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.android.** { *; }
-keep class com.getcapacitor.cordova.** { *; }
-keep @interface com.getcapacitor.annotation.CapacitorPlugin
-keep @interface com.getcapacitor.annotation.JSExport
-keep @interface com.getcapacitor.annotation.Permission
-keep @interface com.getcapacitor.annotation.PermissionCallback

# WebView @JavascriptInterface মেথডগুলো অবশ্যই রাখতে হবে
-keepclassmembers,allowoptimization class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepattributes Signature

# APK self-updater plugin — @CapacitorPlugin + reflection
-keep class com.hishabdaily.app.updater.** { *; }

# Splash screen / appcompat
-keep class androidx.core.app.CoreComponentFactory { *; }
