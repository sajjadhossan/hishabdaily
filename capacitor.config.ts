import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hishabdaily.app",
  appName: "হিসাব",
  webDir: "out",
  // APK-size friendly: extra native plugins একটাও যোগ করা হয়নি —
  // সম্পূর্ণ অ্যাপ WebView-এ চলে, শুধু প্রয়োজনীয় asset-গুলোই প্যাক হয়।
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
