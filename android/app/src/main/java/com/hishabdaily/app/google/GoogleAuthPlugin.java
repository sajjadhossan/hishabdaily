package com.hishabdaily.app.google;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.net.Uri;
import android.os.CancellationSignal;
import android.util.Log;

import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.Collections;
import java.util.concurrent.Executor;

/**
 * নেটিভ Google অ্যাকাউন্ট বাছাই + Drive অনুমতি।
 *
 * - সাইন-ইন: Android Credential Manager → ডিভাইসে লগইন করা Google অ্যাকাউন্টগুলোর
 *   নেটিভ বottom sheet। ID token Firebase-এ দিয়ে সাইন-ইন করা হয় (JS সাইডে)।
 * - Drive: Google Identity Services AuthorizationClient → একই ডিভাইস অ্যাকাউন্ট থেকে
 *   drive.file access token। কোনো ব্রাউজার/ওয়েব পেজ খোলা হয় না।
 */
@CapacitorPlugin(name = "GoogleAuth", requestCodes = { GoogleAuthPlugin.REQ_DRIVE })
public class GoogleAuthPlugin extends Plugin {
    private static final String TAG = "GoogleAuth";
    static final int REQ_DRIVE = 9021;
    private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

    private PluginCall pendingDriveCall;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("platform", "android");
        call.resolve(ret);
    }

    /**
     * serverClientId = Firebase-এর Google provider-এর Web Client ID।
     * ID token-এর aud এই ক্লায়েন্ট আইডির সাথে মেলে — তাই Firebase গ্রহণ করে।
     */
    @PluginMethod
    public void signIn(PluginCall call) {
        final String serverClientId = call.getString("serverClientId");
        if (serverClientId == null || serverClientId.trim().isEmpty()) {
            call.reject("NO_CLIENT_ID", "Google Web Client ID সেট করা নেই।");
            return;
        }
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("NO_ACTIVITY", "অ্যাক্টিভিটি পাওয়া যায়নি।");
            return;
        }

        try {
            GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                    // ডিভাইসে লগইন করা সব Google অ্যাকাউন্ট দেখাতে false
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(serverClientId.trim())
                    .setAutoSelectEnabled(false)
                    .build();

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build();

            CredentialManager credentialManager = CredentialManager.create(activity);
            Executor executor = ContextCompat.getMainExecutor(activity);
            CancellationSignal cancellationSignal = null;

            credentialManager.getCredentialAsync(
                    activity,
                    request,
                    cancellationSignal,
                    executor,
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            try {
                                JSObject data = extractCredential(result);
                                // Drive অনুমতি আলাদা ফ্লো — সাইন-ইন ব্লক না করি
                                call.resolve(data);
                            } catch (Exception e) {
                                Log.e(TAG, "credential parse failed", e);
                                call.reject("BAD_CREDENTIAL", safeMessage(e));
                            }
                        }

                        @Override
                        public void onError(GetCredentialException e) {
                            Log.w(TAG, "credential error", e);
                            call.reject("SIGN_IN_FAILED", safeMessage(e));
                        }
                    }
            );
        } catch (Exception e) {
            Log.e(TAG, "signIn failed", e);
            call.reject("SIGN_IN_FAILED", safeMessage(e));
        }
    }

    private static JSObject extractCredential(GetCredentialResponse result) {
        Credential credential = result == null ? null : result.getCredential();
        if (!(credential instanceof CustomCredential)
                || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            throw new IllegalStateException("Google অ্যাকাউন্ট পাওয়া যায়নি।");
        }
        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(
                ((CustomCredential) credential).getData()
        );
        JSObject data = new JSObject();
        data.put("idToken", nullToEmpty(google.getIdToken()));
        data.put("email", nullToEmpty(google.getId()));
        data.put("name", nullToEmpty(google.getDisplayName()));
        Uri photo = google.getProfilePictureUri();
        data.put("photo", photo == null ? "" : photo.toString());
        return data;
    }

    /** Drive-এর জন্য access token — আগে অনুমতি থাকলে কোনো UI দেখায় না। */
    @PluginMethod
    public void driveToken(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("NO_ACTIVITY", "অ্যাক্টিভিটি পাওয়া যায়নি।");
            return;
        }
        if (pendingDriveCall != null) {
            call.reject("IN_PROGRESS", "Drive অনুমতি চলছে।");
            return;
        }
        pendingDriveCall = call;
        try {
            AuthorizationRequest request = AuthorizationRequest.builder()
                    .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_SCOPE)))
                    .build();

            Identity.getAuthorizationClient(activity)
                    .authorize(request)
                    .addOnSuccessListener(result -> {
                        if (result != null && result.hasResolution() && result.getPendingIntent() != null) {
                            try {
                                activity.startIntentSenderForResult(
                                        result.getPendingIntent().getIntentSender(),
                                        REQ_DRIVE,
                                        null,
                                        0,
                                        0,
                                        0,
                                        null
                                );
                            } catch (IntentSender.SendIntentException e) {
                                rejectPending("AUTH_FAILED", safeMessage(e));
                            }
                            return;
                        }
                        finishDrive(result);
                    })
                    .addOnFailureListener(e -> {
                        Log.w(TAG, "drive authorization failed", e);
                        rejectPending("AUTH_FAILED", safeMessage(e));
                    });
        } catch (Exception e) {
            Log.e(TAG, "driveToken failed", e);
            rejectPending("AUTH_FAILED", safeMessage(e));
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_DRIVE) return;
        Activity activity = getActivity();
        if (activity == null || pendingDriveCall == null) return;
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(activity)
                    .getAuthorizationResultFromIntent(data);
            finishDrive(result);
        } catch (Exception e) {
            Log.e(TAG, "drive result failed", e);
            rejectPending("AUTH_FAILED", safeMessage(e));
        }
    }

    private void finishDrive(AuthorizationResult result) {
        String token = result == null ? null : result.getAccessToken();
        if (token == null || token.isEmpty()) {
            rejectPending("NO_TOKEN", "Drive অনুমতি পাওয়া যায়নি।");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        ret.put("expiresIn", 3600);
        PluginCall call = pendingDriveCall;
        pendingDriveCall = null;
        if (call != null) call.resolve(ret);
    }

    private void rejectPending(String code, String message) {
        PluginCall call = pendingDriveCall;
        pendingDriveCall = null;
        if (call != null) call.reject(code, message);
    }

    private static String safeMessage(Exception e) {
        String msg = e == null ? null : e.getMessage();
        return msg == null || msg.isEmpty() ? "Google সাইন-ইন ব্যর্থ হয়েছে।" : msg;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
