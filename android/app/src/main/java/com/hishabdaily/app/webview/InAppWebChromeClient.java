package com.hishabdaily.app.webview;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Message;
import android.view.View;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;

import androidx.annotation.Nullable;

/**
 * Firebase/Google OAuth popup-এর window.open() কে বাইরের ব্রাউজারে না পাঠিয়ে
 * অ্যাপের ভেতরেই একটি full-screen WebView dialog-এ দেখায়।
 * Capacitor-এর নিজস্ব WebChromeClient-কে delegate করে রাখি, যাতে alert/file picker
 * ইত্যাদি আগের মতোই কাজ করে।
 */
public class InAppWebChromeClient extends WebChromeClient {
    private final Activity activity;
    @Nullable
    private final WebChromeClient delegate;
    @Nullable
    private Dialog popupDialog;
    @Nullable
    private WebView popupWebView;

    public InAppWebChromeClient(Activity activity, @Nullable WebChromeClient delegate) {
        this.activity = activity;
        this.delegate = delegate;
    }

    /** Google WebView-এ সাইন-ইন বлок না করার জন্য "; wv" সরানো হয়। */
    public static String browserUserAgent(WebView view) {
        String ua = view.getSettings().getUserAgentString();
        if (ua == null) return "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 "
                + "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
        return ua.replace("; wv", "").replace("Version/4.0 ", "");
    }

    public static void prepare(WebView webView) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setDomStorageEnabled(true);
        settings.setUserAgentString(browserUserAgent(webView));
        try {
            CookieManager.getInstance().setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            }
        } catch (Throwable ignored) {
            // কিছু ROM-এ CookieManager unavailable — সাধারণ লগইন চলতে পারে
        }
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        if (activity.isFinishing()) return false;

        WebView popup = new WebView(activity);
        WebSettings settings = popup.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setDomStorageEnabled(true);
        settings.setSavePassword(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setUserAgentString(browserUserAgent(view));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                CookieManager.getInstance().setAcceptThirdPartyCookies(popup, true);
            }
        } catch (Throwable ignored) {
            /* ignore */
        }

        popup.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                // Google → Firebase auth handler রিডাইরেক্ট popup-এর ভেতরেই চলে
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return false;
            }
        });

        popup.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView v, boolean d, boolean gesture, Message msg) {
                // nested popup-এর ক্ষেত্রে একই dialog ব্যবহার করি
                WebView.WebViewTransport transport = (WebView.WebViewTransport) msg.obj;
                transport.setWebView(v);
                msg.sendToTarget();
                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                dismissPopup();
            }
        });

        LinearLayout container = new LinearLayout(activity);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setBackgroundColor(Color.WHITE);
        container.addView(popup, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
        ));

        Dialog dialog = new Dialog(activity, android.R.style.Theme_Material_NoActionBar_Fullscreen);
        dialog.setContentView(container);
        dialog.setOnCancelListener(d -> dismissPopup());
        dialog.show();
        Window window = dialog.getWindow();
        if (window != null) {
            window.setLayout(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.MATCH_PARENT
            );
        }

        popupDialog = dialog;
        popupWebView = popup;

        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(popup);
        resultMsg.sendToTarget();
        return true;
    }

    @Override
    public void onCloseWindow(WebView window) {
        dismissPopup();
    }

    private void dismissPopup() {
        try {
            if (popupWebView != null) {
                popupWebView.stopLoading();
                popupWebView.destroy();
            }
        } catch (Throwable ignored) {
            /* ignore */
        }
        try {
            if (popupDialog != null && popupDialog.isShowing()) popupDialog.dismiss();
        } catch (Throwable ignored) {
            /* ignore */
        }
        popupWebView = null;
        popupDialog = null;
    }

    /* ─── Capacitor WebChromeClient-এর বাকি কাজগুলো আগের ক্লায়েন্টকেই দিই ─── */

    @Override
    public void onShowCustomView(View view, CustomViewCallback callback) {
        if (delegate != null) delegate.onShowCustomView(view, callback);
        else super.onShowCustomView(view, callback);
    }

    @Override
    public void onHideCustomView() {
        if (delegate != null) delegate.onHideCustomView();
        else super.onHideCustomView();
    }

    @Override
    public void onPermissionRequest(PermissionRequest request) {
        if (delegate != null) delegate.onPermissionRequest(request);
        else super.onPermissionRequest(request);
    }

    @Override
    public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
        if (delegate != null) return delegate.onJsAlert(view, url, message, result);
        return super.onJsAlert(view, url, message, result);
    }

    @Override
    public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
        if (delegate != null) return delegate.onJsConfirm(view, url, message, result);
        return super.onJsConfirm(view, url, message, result);
    }

    @Override
    public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
        if (delegate != null) return delegate.onJsPrompt(view, url, message, defaultValue, result);
        return super.onJsPrompt(view, url, message, defaultValue, result);
    }

    @Override
    public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        if (delegate != null) delegate.onGeolocationPermissionsShowPrompt(origin, callback);
        else super.onGeolocationPermissionsShowPrompt(origin, callback);
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
        if (delegate != null) return delegate.onShowFileChooser(webView, filePathCallback, params);
        return super.onShowFileChooser(webView, filePathCallback, params);
    }

    @Override
    public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
        if (delegate != null) return delegate.onConsoleMessage(consoleMessage);
        return super.onConsoleMessage(consoleMessage);
    }
}
