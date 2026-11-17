package com.hishabdaily.app;

import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.hishabdaily.app.updater.ApkUpdaterPlugin;
import com.hishabdaily.app.webview.InAppWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // APK self-updater — GitHub release থেকে নতুন APK ডাউনলোড ও ইনস্টল করে
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // Google/Firebase OAuth popup যেন বাইরের ব্রাউজারে না খুলে — অ্যাপের ভেতরেই দেখায়
        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                InAppWebChromeClient.prepare(webView);
                WebChromeClient base = webView.getWebChromeClient();
                webView.setWebChromeClient(new InAppWebChromeClient(this, base));
            }
        }
    }
}
