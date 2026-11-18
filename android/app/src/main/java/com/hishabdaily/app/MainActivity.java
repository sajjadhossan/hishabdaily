package com.hishabdaily.app;

import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;
import com.hishabdaily.app.google.GoogleAuthPlugin;
import com.hishabdaily.app.updater.ApkUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // APK self-updater — GitHub release থেকে নতুন APK ডাউনলোড ও ইনস্টল করে
        registerPlugin(ApkUpdaterPlugin.class);
        // নেটিভ Google অ্যাকাউন্ট বাছাই + Drive অনুমতি (কোনো ব্রাউজার পপআপ নেই)
        registerPlugin(GoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);

        // স্ক্রিন নড়া/রাবার-ব্যান্ড বন্ধ: WebView কখনো overscroll করবে না,
        // কীবোর্ড খুললে পুরো window pan না করে resize করবে (manifest-এ windowSoftInputMode)।
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);
        getBridge().getWebView().setVerticalScrollBarEnabled(false);
    }
}
