# হিসাব (Hishab)

> আয়-ব্যয়, নিয়মিত কেনাকাটা আর দেনা-পাওনার সহজ, সুন্দর ও নিরাপদ ট্র্যাকার।
> Next.js + Firebase + Google Drive ব্যাকআপ — Vercel-এ এক ক্লিকে ডিপ্লয় করার জন্য তৈরি।

![Version](https://img.shields.io/badge/version-1.0.9-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-ffca28?logo=firebase)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)
![License](https://img.shields.io/badge/License-MIT-green)

## 🔗 লাইভ

| পরিবেশ | লিংক |
|---|---|
| **Vercel** (মূল অ্যাপ) | https://hishabdaily.vercel.app |
| **Cloudflare Pages** | https://hishabdaily.pages.dev |
| **ডেটাবেস** | Firestore `hishab-5857e` (একটাই — দুই সাইটেই একই ডেটা) |

> দুই সাইটে **একই Google অ্যাকাউন্টে** সাইন ইন করলে ডেটা রিয়েল-টাইমে সিঙ্ক হয়।

---

## ✨ ফিচার

| | |
|---|---|
| 💰 **আয়-ব্যয়** | খরচ ও আয় আলাদা করে লিখুন, খাত ও অ্যাকাউন্ট (ক্যাশ/বিকাশ/ব্যাংক) বেছে নিন |
| ⚡ **নিয়মিত কেনাকাটা** | প্রতিদিনের চা, রিকশা, বাজার — একবার সেভ করে রাখুন, পরে **এক ট্যাপেই** লেনদেন যোগ |
| 🤝 **দেনা-পাওনা** | কে কত পাবেন/দেবেন আলাদা খাতায়; টাকা দেওয়া, নেওয়া, ফেরত পাওয়া, শোধ করা — সব এন্ট্রি |
| 📊 **রিপোর্ট** | মাসিক/বাৎসরিক সারসংক্ষেপ, খাতভিত্তিক বিশ্লেষণ, অ্যাকাউন্টভিত্তিক খরচ, বাজেটের অবস্থা |
| 🎯 **মাসিক বাজেট** | বাজেট সেট করলে ড্যাশবোর্ডেই অগ্রগতি দেখা যায় |
| 🔐 **লগইন** | Google দিয়ে এক ক্লিক সাইন-ইন + ইমেইল/পাসওয়ার্ড, সাইন আপ, পাসওয়ার্ড রিসেট |
| ☁️ **ক্লাউড সিঙ্ক** | Firestore-এ রিয়েল-টাইম সিঙ্ক — ফোন ও কম্পিউটারে একই ডেটা |
| 💾 **Google Drive ব্যাকআপ** | JSON ব্যাকআপ Drive-এ, দিনে একবার অটো-ব্যাকআপ, এক ক্লিকে রিস্টোর |
| 📱 **PWA** | ফোনের হোম স্ক্রিনে অ্যাপের মতো ইনস্টল করা যায় |
| 📲 **APK আপডেট** | GitHub Release-এ নতুন APK এলে অ্যাপের ভেতরেই আপডেট — আনইনস্টল ছাড়াই ইনস্টল |
| 🌗 **ডার্ক মোড** | লাইট/ডার্ক/সিস্টেম + বাংলা সংখ্যায় দেখানোর অপশন |
| 📤 **রপ্তানি** | CSV (Excel/Sheets) ও JSON ফাইল ডাউনলোড |
| 🧠 **স্মার্ট ইম্পোর্ট** | PDF (টেক্সট/স্ক্যান OCR), CSV, Excel, JSON বা যেকোনো টেক্সট ফাইল থেকে তারিখ·টাকা·খাত শনাক্ত; রিভিউ/দ্রুত ইম্পোর্ট, ডুপ্লিকেট এড়ানো, JSON+CSV ব্যাকআপ |

### 🧠 স্মার্ট ইম্পোর্ট

`/import` পেজে (সেটিংস → স্মার্ট ইম্পোর্ট বা সাইডবার) যেকোনো পুরোনো ফাইল দিন:

- **PDF** — টেক্সট লেয়ার থাকলে সরাসরি পড়া হয়; স্ক্যান করা হলে ব্রাউজারে `tesseract.js` দিয়ে OCR (eng+ben)।
- **CSV / TSV / XLSX / TXT / JSON** — হেডার শনাক্ত করে `Date, Description, Debit, Credit, Balance` ইত্যাদি কলাম ম্যাপ করা হয়; বাংলা তারিখ/অঙ্কও বোঝে।
- প্রতিটি লাইন থেকে **তারিখ, অঙ্ক, আয়/ব্যয়/দেনা-পাওনা ও খাত** বের হয়। কম নিশ্চিত রো হলুদ মার্ক থাকে।
- **রিভিউ মোড** (ডিফল্ট): টেবিলে বসে ভুল ঠিক করে তারপর সেভ করুন। **দ্রুত মোড**: সরাসরি সেভ।
- একই ফাইল বা একই লেনদেন আবার দিলে **ডুপ্লিকেট তৈরি হয় না**। সেভের পর JSON/CSV ব্যাকআপ ডাউনলোড করা যায়।
- সব পার্সিং ব্রাউজারেই হয় — ফাইল কোথাও আপলোড হয় না। PDF/Tesseract worker `public/`-এ থাকে; শুধু OCR-এর ভাষা প্রথমবার CDN থেকে আসে।

> কোনো নির্দিষ্ট ব্যাংক/অ্যাপের CBC ফরম্যাট ঠিকমতো না পড়লে একটা নমুনা ফাইল (ডেটা বদলে) পাঠালে সেই ফরম্যাটের জন্য পার্সার মানিয়ে নেওয়া যায়।

---

## 🧱 টেক স্ট্যাক

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- **Firebase**: Authentication (Google, Email/Password) + Cloud Firestore (offline persistence)
- **Google Drive API** (`drive.file` স্কোপ) — শুধু অ্যাপের নিজের তৈরি ব্যাকআপ ফাইল দেখতে পারে
- **Vercel**-এ ডিপ্লয় করার জন্য প্রস্তুত

---

## 🚀 লোকাল সেটআপ

```bash
pnpm install      # বা: npm install
cp .env.example .env.local
pnpm dev          # http://localhost:3000
```

> Firebase কনফিগ না দিয়েও **ডেমো মোডে** অ্যাপটি চালিয়ে দেখতে পারবেন — লগইন পেজে
> “ডেমো মোড” বাটনে চাপুন। ডেটা শুধু ব্রাউজারে (localStorage) থাকবে।

### 🌐 ফোন/অন্য ডিভাইসে প্রিভিউ (Cloudflare Tunnel)

অ্যাপটা অন্য কারো ফোনে বা যেকোনো ব্রাউজারে দেখানোর জন্য এক কমান্ডেই একটা পাবলিক লিংক পাবেন:

```bash
pnpm preview          # আগের বিল্ড দিয়ে সার্ভার + পাবলিক লিংক
pnpm preview:build    # কোড বদলালে নতুন করে বিল্ড করে তারপর লিংক
```

- টার্মিনালে `https://xxxx.trycloudflare.com` ধরনের একটি লিংক দেখাবে — সেটাই শেয়ার করুন।
- লিংকটি `.preview-url` ফাইলেও লেখা থাকে (`cat .preview-url`)।
- `Ctrl+C` চাপলে সার্ভার ও লিংক দুটোই বন্ধ হয়ে যাবে।
- প্রতিবার চালালে **নতুন লিংক** তৈরি হয় (এই লিংক স্থায়ী নয়)।
- Cloudflare অ্যাকাউন্ট বা লগইন লাগে না — শুধু `cloudflared` ইনস্টল থাকতে হবে
  (`pkg install cloudflared`)।

---

## 🔥 Firebase সেটআপ (ধাপে ধাপে)

1. [Firebase Console](https://console.firebase.google.com) → **Add project** → নাম দিন।
2. **Build → Authentication → Get started**
   - **Google** চালু করুন (support email দিন)।
   - **Email/Password** চালু করুন।
3. **Build → Firestore Database → Create database** (Production mode) → লোকেশন বেছে নিন।
4. **Firestore → Rules** ট্যাবে `firestore.rules` ফাইলের নিয়ম পেস্ট করে **Publish** করুন:

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

5. **Project settings (⚙️) → Your apps → Web (`</>`)** → অ্যাপ রেজিস্টার করুন →
   `firebaseConfig` অবজেক্টটি কপি করুন।
6. কনফিগ বসানোর **তিনটি উপায়** (যেকোনো একটি):

   **ক) env ভেরিয়েবল (সুপারিশকৃত — Vercel/localhost)**
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-app
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

   **খ) অ্যাপের ভেতর থেকেই** — `/setup` পেজে গিয়ে পুরো `firebaseConfig`
   অবজেক্ট পেস্ট করুন (ব্রাউজারে সেভ হবে)। ডিপ্লয়ের পর সাধারণ ব্যবহারকারীর জন্য
   সবচেয়ে সহজ উপায়।

   **গ) `public/firebase-config.json`** — `public/firebase-config.example.json`
   কপি করে আসল মান বসান (রিবিল্ড ছাড়াই বদলানো যায়)।

7. **Authentication → Settings → Authorized domains**-এ আপনার ডোমেইন যোগ করুন
   (`localhost` সাধারণত থাকে; Vercel-এর `your-app.vercel.app` যোগ করতে হবে)।

> ⚠️ Firebase API key পাবলিক থাকা স্বাভাবিক — নিরাপত্তা আসে **Firestore Rules** থেকে।
> উপরের নিয়ম ছাড়া ডেটা পাবলিক হয়ে যেতে পারে, তাই অবশ্যই বসাবেন।

---

## ☁️ Google Drive ব্যাকআপ সেটআপ

**সহজ পথ:** শুধু **Google দিয়ে সাইন ইন** করলেই হয় — লগইনের সময়ই Drive-এর অনুমতি
নেওয়া হয়, আলাদা Client ID লাগে না। এর জন্য Firebase প্রজেক্টে একবার
**Google Drive API** চালু করতে হবে ও OAuth consent screen-এ `drive.file` স্কোপ
যোগ করতে হবে — পুরো ধাপ **`docs/GOOGLE-SETUP.md`**-এ আছে।

**ঐচ্ছিক (পুরোনো পথ):** ইমেইল/পাসওয়ার্ড অ্যাকাউন্টেও Drive ব্যাকআপ চাইলে একটা
OAuth Web Client ID বানিয়ে `/setup` পেজে বা `NEXT_PUBLIC_GOOGLE_CLIENT_ID`-এ দিন:

1. [Google Cloud Console](https://console.cloud.google.com) → Firebase প্রজেক্টটিই বেছে নিন।
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   **Web application**।
3. **Authorized JavaScript origins**: `http://localhost:3000` আর আপনার ডিপ্লয় করা
   ডোমেইন (যেমন `https://hishabdaily.pages.dev`)।
4. Client ID কপি করে `/setup` পেজে বসান।

> `drive.file` স্কোপের কারণে অ্যাপ শুধু নিজের তৈরি “Hishab Backups” ফোল্ডারের
> ফাইল পড়তে/লিখতে পারে — আপনার Drive-এর বাকি কিছুই দেখতে পায় না।

---

## ▲ Vercel-এ ডিপ্লয়

### ১) GitHub-এ আপলোড

```bash
git init
git add .
git commit -m "feat: hishab expense tracker"
git branch -M main
git remote add origin https://github.com/<username>/hishabdaily.git
git push -u origin main
```

### ২) Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → রিপো চয়ন করুন।
2. Framework: **Next.js** (স্বয়ংক্রিয়ভাবে ধরা পড়বে)।
3. **Environment Variables**-এ `.env.example`-এর সব ভেরিয়েবল যোগ করুন
   (Build & Production দুটোতেই)।
4. **Deploy** চাপুন।
5. ডিপ্লয় শেষে Vercel ডোমেইনটি Firebase **Authorized domains** ও Google OAuth
   **Authorized JavaScript origins**-এ যোগ করুন।
6. (ঐচ্ছিক) `firebase-config.json` পদ্ধতি ব্যবহার করলে সেটি `public/`-এ রাখুন —
   রিবিল্ড ছাড়াই কনফিগ বদলানো যাবে।

### Firebase CLI দিয়ে নিয়ম ডিপ্লয় (ঐচ্ছিক)

```bash
npm i -g firebase-tools
firebase login
firebase use --add        # আপনার প্রজেক্ট বেছে নিন
firebase deploy --only firestore:rules
```

---

## ☁️ Cloudflare Pages-এ স্থায়ী লিংক

অ্যাপটি পুরোপুরি ক্লায়েন্ট-সাইড, তাই Cloudflare Pages-এ স্ট্যাটিক আকারে হোস্ট করা যায় —
ফলাফল: **`https://hishabdaily.pages.dev`** ধরনের স্থায়ী লিংক (ফ্রি)।

```bash
pnpm build:pages                      # out/ ফোল্ডার তৈরি হবে
CLOUDFLARE_API_TOKEN=xxxx pnpm deploy:pages
```

- টোকেন বানান: [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
  → **Create Token** → **Edit Cloudflare Workers** টেমপ্লেট, অথবা কাস্টম টোকেনে
  **Account → Cloudflare Pages → Edit** অনুমতি দিন।
- প্রথমবার চালালে `hishabdaily` নামে প্রজেক্ট তৈরি হয়, এরপর প্রতিবার একই লিংকে নতুন বিল্ড যায়।
- অন্য নাম চাইলে: `PAGES_PROJECT=my-app pnpm deploy:pages`
- টোকেন শুধু ওই এক কমান্ডেই লাগে; কোথাও সেভ হয় না।

---

## 🔄 Vercel + Cloudflare — একই ডেটা, দুই জায়গায়

অ্যাপের ডেটা থাকে **Firebase Firestore**-এ। তাই একই Firebase প্রজেক্ট ব্যবহার করলেই
দুই ডিপ্লয়মেন্টের ডেটা **রিয়েল-টাইমে** সিঙ্ক হয় (`onSnapshot` লিসেনার) — এক জায়গায়
যোগ করলে কয়েকশ মিলিসেকেন্ডে অন্যটায় দেখা যায়।

শর্ত:

1. দুই জায়গায় **একই Firebase কনফিগ** (Vercel env বা `public/firebase-config.json`)
2. দুই ডোমেইনই Firebase → Authentication → **Authorized domains**-এ
3. দুই সাইটে **একই Google/ইমেইল অ্যাকাউন্টে** লগইন

### Vercel-এ অটো-ডিপ্লয়

1. [vercel.com/new](https://vercel.com/new) → GitHub রিপোটা **Import** করুন
2. Framework: **Next.js** (স্বয়ংক্রিয়), Install/Build কমান্ড ডিফল্ট থাকতে দিন
3. **Deploy** — এরপর প্রতিবার `git push` করলেই Vercel **কয়েক সেকেন্ডে** পরিবর্তন ধরে
   নিয়ে নতুন বিল্ড শুরু করে (বিল্ড শেষ হতে সাধারণত ১–৩ মিনিট)

### Cloudflare-এ অটো-ডিপ্লয় (GitHub Actions)

`.github/workflows/cloudflare-pages.yml` **সেটআপ করা আছে ও চালু** — `git push` করলেই
GitHub Actions স্ট্যাটিক বিল্ড (`out/`) তৈরি করে Cloudflare Pages-এ ডিপ্লয় করে।

- `CLOUDFLARE_API_TOKEN` — Account → Cloudflare Pages → **Edit** (রিপো সিক্রেটে সেট করা)
- `CLOUDFLARE_ACCOUNT_ID` — অ্যাকাউন্ট আইডি (রিপো সিক্রেটে সেট করা)

টোকেন না থাকলে/মেয়াদ শেষ হলে ওয়ার্কফ্লো লাল হয় না — শুধু ডিপ্লয় ধাপটা স্কিপ হয়।

> ⚠️ **Google Drive ব্যাকআপ** একটা স্ন্যাপশট — সেটা সিঙ্ক নয়। দুই অ্যাপের ডেটা
> মেলানোর একমাত্র উৎস Firestore।

---

## 📲 Android APK ও আপডেট

- সর্বশেষ APK: [GitHub Releases](https://github.com/sajjadhossan/hishabdaily/releases/latest) — লগইন ছাড়াই সরাসরি ডাউনলোড।
- অ্যাপ খোলার সময় নতুন release থাকলে ব্যানার দেখায়; **সেটিংস → APK আপডেট** থেকে ম্যানুয়ালি চেক করা যায়।
- প্রথমবার “Install unknown apps” অনুমতি দিতে হবে। পরের আপডেটগুলো **আনইনস্টল ছাড়াই** ইনস্টল হয়—লেনদেন, ব্যাকআপ ও সেটিংস থাকে।
- প্যাকেজ `com.hishabdaily.app`; প্রতিটি APK একই signing certificate দিয়ে সাইন হয়, তাই versionCode বাড়ালেই in-place আপডেট কাজ করে।

> 🛠️ **ডেভেলপমেন্ট নিয়ম:** প্রতিটি `git push`-এর আগে `pnpm version:bump` চালান। CI দেখে নেয় যে ভার্সন বাড়ানো হয়েছে কি না; না বাড়ালে push-এর বিল্ড বানানো হয় না।

---

## 📁 প্রজেক্ট কাঠামো

```
app/
  (app)/                 # লগইন-প্রোটেক্টেড পেজ
    dashboard/           # হোম — ব্যালেন্স, চার্ট, দ্রুত যোগ
    transactions/        # সব লেনদেন, সার্চ ও ফিল্টার
    templates/           # নিয়মিত কেনাকাটা (এক ট্যাপ)
    contacts/            # দেনা-পাওনা — ব্যক্তি ও লেজার
    reports/             # মাসিক/বাৎসরিক রিপোর্ট
    settings/            # প্রোফাইল, খাত, বাজেট, ব্যাকআপ
  login/ signup/ forgot-password/ setup/
components/              # UI, ফর্ম, চার্ট, শেল
lib/
  auth.tsx               # Firebase Auth + ডেমো মোড
  data.tsx               # Firestore/localStorage ডেটা লেয়ার
  drive.ts               # Google Drive ব্যাকআপ
  stats.ts               # হিসাব-নিকাশ
  types.ts / utils.ts
firestore.rules          # নিরাপত্তা নিয়ম
```

### ডেটা মডেল (Firestore)

```
users/{uid}                                  → { settings: {...} }
users/{uid}/transactions/{id}                → { type, amount, category, account, note, date, createdAt }
users/{uid}/templates/{id}                   → { name, emoji, amount, category, account, uses, lastUsed }
users/{uid}/contacts/{id}                    → { name, phone, note, createdAt }
users/{uid}/debts/{id}                       → { contactId, contactName, kind, amount, note, date, txId? }
```

`debts.kind`: `lent` (দিয়েছি) · `borrowed` (নিয়েছি) · `lent_repaid` (ফেরত পেয়েছি) ·
`borrowed_repaid` (ফেরত দিয়েছি)। ব্যালেন্স = `lent + borrowed_repaid − borrowed − lent_repaid`।

---

## 🧪 বিল্ড যাচাই

```bash
pnpm exec tsc --noEmit     # টাইপ চেক
pnpm build                 # প্রোডাকশন বিল্ড
```

> 📱 **Termux/Android-এ বিল্ড:** Next.js-এর নেটিভ SWC বাইনারি Android-এর জন্য প্রকাশিত
> হয় না। তাই `scripts/next.cjs` শুধু Android-এ WASM SWC (`@next/swc-wasm-nodejs`)
> স্বয়ংক্রিয়ভাবে প্রিলোড করে। Vercel/Linux-এ এটি নিষ্ক্রিয় থাকে এবং সাধারণ নেটিভ
> বাইনারি ব্যবহৃত হয় — আলাদা কিছু করতে হয় না। প্রথম বিল্ডে WASM প্যাকেজ ডাউনলোড
> হতে একটু সময় লাগতে পারে।

---

## 🛠 সমস্যা ও সমাধান

| সমস্যা | সমাধান |
|---|---|
| `auth/unauthorized-domain` | Firebase → Authentication → Settings → Authorized domains-এ ডোমেইন যোগ করুন |
| `auth/operation-not-allowed` | Authentication-এ Google ও Email/Password চালু করুন |
| Google পপআপ আটকে যাচ্ছে | ব্রাউজারের পপআপ অনুমতি দিন; মোবাইলে Chrome/Safari ব্যবহার করুন |
| Firestore permission denied | `firestore.rules` পাবলিশ করুন (উপরে দেওয়া নিয়ম) |
| Drive ব্যাকআপ কাজ করছে না | Drive API চালু, `drive.file` স্কোপ, OAuth JS origin ঠিক আছে কিনা দেখুন |
| “Hishab Backups” ফোল্ডার দেখা যাচ্ছে না | Drive-এর সার্চে ফোল্ডারের নাম লিখে খুঁজুন (অ্যাপ-তৈরি ফাইল) |
| পুরোনো ডেটা দেখাচ্ছে | সেটিংস → ডেটা → রিস্টোর, অথবা পেজ রিফ্রেশ করুন |

---

## 🔒 নিরাপত্তা

- প্রতিটি ব্যবহারকারীর ডেটা `users/{uid}`-এর ভেতরে; Firestore Rules দিয়ে শুধু মালিকের
  অ্যাক্সেস নিশ্চিত করা হয়।
- Google Drive-এ শুধু `drive.file` স্কোপ — অ্যাপের তৈরি ফাইল ছাড়া কিছু পড়া/লেখা সম্ভব নয়।
- Firebase API key ক্লায়েন্টে থাকা স্বাভাবিক; গোপন তথ্য (service account key) কখনো
  `NEXT_PUBLIC_` ভেরিয়েবলে রাখবেন না।
- ব্যাকআপে আপনার সব আর্থিক তথ্য থাকে — JSON ফাইলটি কারো সাথে শেয়ার করবেন না।

---

## 📄 লাইসেন্স

MIT — ব্যক্তিগত ও বাণিজ্যিক ব্যবহারের জন্য মুক্ত।
