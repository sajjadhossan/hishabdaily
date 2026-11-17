package com.hishabdaily.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.hishabdaily.app.updater.ApkUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // APK self-updater — GitHub release থেকে নতুন APK ডাউনলোড ও ইনস্টল করে
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
