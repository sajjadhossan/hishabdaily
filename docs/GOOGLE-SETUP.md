# 🔐 Google লগইন ও Drive ব্যাকআপ — সম্পূর্ণ সেটআপ

এই গাইডটা একবার করলেই অ্যাপে **সরাসরি Google দিয়ে লগইন** আর **Google Drive-এ
ব্যাকআপ** দুটোই কাজ করবে। আলাদা Google Client ID বানানো লাগবে না — লগইনের সময়ই
Drive-এর অনুমতি নেওয়া হয়।

> ⏱️ সময়: ১০–১৫ মিনিট। যা যা করবেন, ঠিক ধাপে ধাপে নিচে লেখা আছে।

---

## ১) Firebase প্রজেক্ট বানান

1. যান **https://console.firebase.google.com**
2. **Add project** (বা Create a project)
3. নাম দিন, যেমন `hishab` → **Continue**
4. Google Analytics: **চালু না করলেও চলবে** → **Create project** → **Continue**

## ২) Web অ্যাপ যোগ করুন

1. প্রজেক্ট হোম পেজে **`</>`** (Web) আইকনে ক্লিক করুন
2. App nickname: `hishab-web` → **Register app**
3. স্ক্রিনে এমন একটা কোড দেখাবে:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "hishab-xxxx.firebaseapp.com",
  projectId: "hishab-xxxx",
  storageBucket: "hishab-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

👉 **এই পুরো কোডটা কপি করে আমাকে পাঠিয়ে দিন** (বা অ্যাপের `/setup` পেজে পেস্ট করুন)।
Firebase-এর এই কনফিগ গোপন কিছু নয় — এটা ব্রাউজারে দেখা যায়, তাই শেয়ার করা নিরাপদ।

## ৩) Google লগইন চালু করুন

1. বাঁ দিকের মেনু → **Build → Authentication**
2. **Get started**
3. **Sign-in method** ট্যাব → **Google** → চালু করুন
   - Project public-facing name: `হিসাব`
   - Support email: আপনার ইমেইল
   - **Save**
4. একই তালিকায় **Email/Password** → চালু করুন → **Save**

## ৪) ডোমেইন অনুমোদন করুন

1. **Authentication → Settings** ট্যাব → **Authorized domains**
2. **Add domain** দিয়ে যোগ করুন (যেগুলো ব্যবহার করবেন):
   - `hishab.pages.dev` (Cloudflare লিংক)
   - `localhost` (আগে থেকেই থাকে)
   - আপনার Vercel লিংক, যেমন `hishab-xxxx.vercel.app`
   - টানেল লিংক ব্যবহার করলে সেটাও (যেমন `xxxx.trycloudflare.com`)

> ডোমেইন না যোগ করলে Google লগইনে `auth/unauthorized-domain` এরর আসবে।

## ৫) Firestore ডেটাবেস ও নিয়ম

1. **Build → Firestore Database → Create database**
2. লোকেশন বেছে নিন (যেমন `asia-south1`) → **Next**
3. **Production mode** → **Create**
4. **Rules** ট্যাবে গিয়ে পুরোটা মুছে নিচেরটা পেস্ট করুন → **Publish**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      match /{collection}/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

## ৬) Google Drive API চালু করুন

1. **https://console.cloud.google.com** খুলুন (Firebase-এর একই প্রজেক্ট বেছে নিন —
   উপরের ড্রপডাউনে `hishab-xxxx`)
2. **APIs & Services → Library** → সার্চে লিখুন **Google Drive API** → **Enable**

## ৭) OAuth consent screen ঠিক করুন

1. **APIs & Services → OAuth consent screen**
2. **External** → **Create**
3. App name: `হিসাব`, support email দিন → **Save and continue**
4. **Scopes → Add or remove scopes** → খুঁজে যোগ করুন:
   `.../auth/drive.file` (Google Drive API-এর অধীনে) → **Update** → **Save and continue**
5. **Test users → Add users** → **আপনার নিজের Gmail ঠিকানা** যোগ করুন → **Save**
   > অ্যাপ “Testing” অবস্থায় থাকলেও নিজের অ্যাকাউন্টে ব্যাকআপ কাজ করবে।
   > অন্যকে ব্যবহার করতে দিতে চাইলে তাঁদেরও Test users-এ যোগ করুন।
6. **Back to dashboard**

## ৮) অ্যাপে কনফিগ বসান

দুইভাবে করা যায় (একটা করলেই হবে):

**ক) আমাকে কোডটা পাঠান** — আমি ডিপ্লয়মেন্টে বসিয়ে দেব (সব ডিভাইসে একসাথে কাজ করবে)।

**খ) নিজে করুন** — অ্যাপের `/setup` পেজ খুলে ধাপ ২-এর কোডটা পেস্ট করুন →
Google Client ID ঘরটা **খালি রাখুন** → **সেভ**। এই কনফিগ শুধু ওই ব্রাউজারে থাকে।

## ৯) পরীক্ষা করুন

1. অ্যাপ খুলুন → **Google দিয়ে চালিয়ে যান**
2. Google পপআপে অ্যাকাউন্ট বেছে নিন
3. Drive-এর অনুমতি চাইলে **Allow** দিন (ব্যাকআপের জন্য)
4. সেটিংস → **এখনই ব্যাকআপ নিন** → ড্রাইভে `Hishab Backups` ফোল্ডার তৈরি হবে

---

## 🔄 Vercel আর Cloudflare — দুই জায়গায় একই ডেটা

ডেটা থাকে **Firebase Firestore**-এ, অ্যাপের ভেতরে নয়। তাই দুই জায়গায় **একই
Firebase প্রজেক্টের কনফিগ** বসালেই এক জায়গায় যোগ করা লেনদেন কয়েক সেকেন্ডের মধ্যেই
অন্য জায়গায় দেখা যাবে (অ্যাপ রিয়েল-টাইম লিসেনার ব্যবহার করে), এবং উল্টোটাও।

শর্ত তিনটি:

| শর্ত | কোথায় |
|---|---|
| দুটো ডিপ্লয়মেন্টে **একই** Firebase কনফিগ | Vercel → Environment Variables, Cloudflare → `/setup` বা ফাইল |
| দুটো ডোমেইনই **Authorized domains**-এ | Firebase → Authentication → Settings |
| একই Google/ইমেইল অ্যাকাউন্টে লগইন | — (ভিন্ন অ্যাকাউন্ট হলে ডেটা আলাদা থাকবে) |

Vercel-এ কম্পাইল-টাইম env ব্যবহার করলে `NEXT_PUBLIC_FIREBASE_*` ভেরিয়েবলগুলো
**Production** এনভায়রনমেন্টে যোগ করে **Redeploy** করতে হবে। অথবা `public/firebase-config.json`
রাখলে রিবিল্ড ছাড়াই কনফিগ বদলানো যায়।

---

## ❗ সমস্যা হলে

| এরর | সমাধান |
|---|---|
| `auth/operation-not-allowed` | Firebase → Authentication → Google/Email চালু করুন |
| `auth/unauthorized-domain` | ধাপ ৪-এ ডোমেইনটা যোগ করুন |
| `auth/popup-blocked` | ব্রাউজারে পপআপ অনুমতি দিন, অথবা আবার চাপুন |
| `access_denied` / `403` (Drive) | ধাপ ৬-এ Drive API চালু ও ধাপ ৭-এ `drive.file` স্কোপ যোগ করুন |
| ব্যাকআপে “insufficient permission” | লগআউট করে আবার Google দিয়ে সাইন ইন করুন (নতুন স্কোপ নিতে হবে) |
