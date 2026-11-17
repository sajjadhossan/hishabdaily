package com.hishabdaily.app.updater;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.Locale;

/** APK-এর ভেতর থেকেই নতুন release ডাউনলোড ও ইনস্টল করে। */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private static final String TAG = "ApkUpdater";
    private static final String FILE_NAME = "hishabdaily-update.apk";
    private static final String PROGRESS_EVENT = "downloadProgress";
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 30000;

    private static class InstallPermissionException extends Exception {
        InstallPermissionException() {
            super("Install unknown apps permission is not granted");
        }
    }

    @PluginMethod
    public void checkInstallPermission(PluginCall call) {
        JSObject ret = new JSObject();
        boolean can = canRequestInstall();
        ret.put("canInstall", can);
        ret.put("hasPermission", can);
        ret.put("androidSdk", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            ret.put("opened", false);
            ret.put("canInstall", true);
            call.resolve(ret);
            return;
        }

        Context ctx = getContext();
        Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + ctx.getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(intent);
            ret.put("opened", true);
        } catch (ActivityNotFoundException e) {
            try {
                Intent fallback = new Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + ctx.getPackageName())
                );
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
                ret.put("opened", true);
                ret.put("fallback", true);
            } catch (ActivityNotFoundException ignored) {
                ret.put("opened", false);
            }
        }
        ret.put("canInstall", canRequestInstall());
        call.resolve(ret);
    }

    @PluginMethod
    public void hasDownloaded(PluginCall call) {
        File apk = apkFile();
        JSObject ret = new JSObject();
        boolean exists = apk != null && apk.exists() && apk.length() > 0;
        ret.put("downloaded", exists);
        if (exists) {
            ret.put("path", apk.getAbsolutePath());
            ret.put("size", apk.length());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void installDownloaded(PluginCall call) {
        try {
            File apk = apkFile();
            if (apk == null || !apk.exists() || apk.length() == 0) {
                call.reject("NO_FILE", "ডাউনলোড করা APK পাওয়া যায়নি। আবার ডাউনলোড করুন।");
                return;
            }
            installInternal(apk);
            JSObject ret = new JSObject();
            ret.put("installStarted", true);
            ret.put("path", apk.getAbsolutePath());
            call.resolve(ret);
        } catch (InstallPermissionException e) {
            call.reject("PERMISSION_REQUIRED", "Install unknown apps অনুমতি দরকার।");
        } catch (Exception e) {
            Log.e(TAG, "installDownloaded failed", e);
            call.reject("INSTALL_FAILED", safeMessage(e));
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String rawUrl = call.getString("url");
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            call.reject("BAD_URL", "APK-এর লিংক পাওয়া যায়নি।");
            return;
        }
        if (!canRequestInstall()) {
            call.reject("PERMISSION_REQUIRED", "Install unknown apps অনুমতি দরকার।");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URI uri = new URI(rawUrl.trim());
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if (scheme == null || !scheme.toLowerCase(Locale.ROOT).equals("https")) {
                    throw new IOException("শুধু HTTPS লিংক থেকে APK ডাউনলোড করা যাবে।");
                }
                if (host == null || !(host.equals("github.com")
                        || host.endsWith(".githubusercontent.com"))) {
                    throw new IOException("অনুমোদিত GitHub release লিংক নয়।");
                }

                File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) throw new IOException("Download ফোল্ডার পাওয়া যায়নি।");
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new IOException("Download ফোল্ডার তৈরি করা যায়নি।");
                }

                File temp = new File(dir, FILE_NAME + ".part");
                File apk = new File(dir, FILE_NAME);
                if (temp.exists() && !temp.delete()) {
                    Log.w(TAG, "Could not delete stale partial file");
                }

                URL url = uri.toURL();
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
                connection.setRequestProperty("User-Agent", "HishabDaily-Android-Updater");

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IOException("APK ডাউনলোড ব্যর্থ (HTTP " + status + ")।");
                }

                long total = connection.getContentLengthLong();
                long downloaded = 0;
                int lastPercent = -5;
                try (InputStream in = connection.getInputStream();
                     OutputStream out = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[16 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        downloaded += read;
                        if (total > 0) {
                            int percent = (int) ((downloaded * 100) / total);
                            if (percent >= lastPercent + 5 || percent >= 100) {
                                lastPercent = percent;
                                emitProgress(percent, downloaded, total);
                            }
                        }
                    }
                    out.flush();
                }

                if (downloaded == 0 || !temp.exists() || temp.length() == 0) {
                    throw new IOException("APK ফাইল খালি পাওয়া গেছে।");
                }
                if (apk.exists() && !apk.delete()) {
                    Log.w(TAG, "Could not delete previous APK; overwriting via rename");
                }
                if (!temp.renameTo(apk)) {
                    throw new IOException("APK ফাইল সেভ করা যায়নি।");
                }
                emitProgress(100, apk.length(), apk.length());

                installInternal(apk);
                JSObject ret = new JSObject();
                ret.put("installStarted", true);
                ret.put("path", apk.getAbsolutePath());
                ret.put("size", apk.length());
                resolveOnUi(call, ret);
            } catch (InstallPermissionException e) {
                rejectOnUi(call, "PERMISSION_REQUIRED", "Install unknown apps অনুমতি দরকার।");
            } catch (Exception e) {
                Log.e(TAG, "downloadAndInstall failed", e);
                rejectOnUi(call, "DOWNLOAD_FAILED", safeMessage(e));
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "hishab-apk-update").start();
    }

    private File apkFile() {
        File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return dir == null ? null : new File(dir, FILE_NAME);
    }

    private boolean canRequestInstall() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void installInternal(File apk) throws InstallPermissionException, IOException {
        if (!canRequestInstall()) throw new InstallPermissionException();
        if (!apk.exists() || apk.length() == 0) {
            throw new IOException("APK ফাইল পাওয়া যায়নি।");
        }

        Uri uri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            String authority = getContext().getPackageName() + ".fileprovider";
            uri = FileProvider.getUriForFile(getContext(), authority, apk);
        } else {
            uri = Uri.fromFile(apk);
        }

        Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().grantUriPermission(
                    "com.android.packageinstaller",
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Exception ignored) {
            // কিছু ROM-এ installer.alias আলাদা — FLAG_GRANT_READ_URI_PERMISSION যথেষ্ট
        }
        emitProgress(100, apk.length(), apk.length());
        getContext().startActivity(intent);
    }

    private void emitProgress(int percent, long downloaded, long total) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            JSObject data = new JSObject();
            data.put("percent", percent);
            data.put("downloaded", downloaded);
            data.put("total", total);
            notifyListeners(PROGRESS_EVENT, data);
        });
    }

    private void resolveOnUi(PluginCall call, JSObject value) {
        if (getActivity() == null) {
            call.resolve(value);
            return;
        }
        getActivity().runOnUiThread(() -> call.resolve(value));
    }

    private void rejectOnUi(PluginCall call, String code, String message) {
        if (getActivity() == null) {
            call.reject(code, message);
            return;
        }
        getActivity().runOnUiThread(() -> call.reject(code, message));
    }

    private static String safeMessage(Exception e) {
        String msg = e.getMessage();
        return msg == null || msg.isEmpty() ? "APK আপডেট ব্যর্থ হয়েছে।" : msg;
    }
}
