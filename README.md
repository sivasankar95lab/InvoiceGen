# ⚡ SwiftBill: The Ultimate Indian Invoice Generator 🧾

> **Fast. Secure. Beautiful. GST-Ready.**
> 
> *The simplest way to create professional invoices right from your browser, with zero server lock-in and 100% data privacy.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.3.0-green.svg)]()
[![PWA Ready](https://img.shields.io/badge/PWA-Advanced_Offline-orange.svg)]()
[![Sync](https://img.shields.io/badge/Sync-Supabase_Cloud-blueviolet.svg)]()

Welcome to the **Next-Generation Invoice Generator**. We stripped away the bloat, subscriptions, and server lag to build a blazing-fast, local-first application tailored for freelancers, agencies, and small businesses in India.

---

## 🌟 Why Choose This Generator?

Unlike traditional billing software, our generator runs **entirely in your browser**. It uses IndexedDB for massive local storage and Service Workers for an app-like offline experience. Your data is yours.

### 🔥 Disruptive Features
- **Smart Profile Management**: Auto-save clients and companies. Our new *Smart Duplicate-Blocker* prevents you from creating duplicate clients by matching Phone Numbers or Names—keeping your database clean!
- **Instant Search**: Find any client instantly via the unified modal search. Just type a name or phone number, and boom—it's there.
- **Flawless Offline Mode (v14)**: Our aggressive Service Worker caching ensures you can generate invoices even on an airplane. No internet? No problem.
- **GST Engine**: Complex tax math simplified. Select between Intra-State (CGST + SGST) and Inter-State (IGST) and watch the totals calculate magically.
- **One-Click Sync**: Working across devices? Connect to Supabase for real-time cloud synchronization without giving up your local-first speed.

### 🎨 Craftsmanship & UX
- **On-Screen Canvas Signatures**: Draw your signature right on the screen using mouse or touch.
- **Automated "Amount in Words"**: Because nobody likes spelling out "Seventy-Five Thousand Four Hundred Rupees Only".
- **Real-Time PDF Previews**: See exactly what your client will see before hitting download.
- **Gorgeous Dark Mode**: Fully responsive, buttery-smooth UI that respects your retinas at 2 AM.

---

## 🚀 Get Up & Running in Seconds

No `npm install`, no database setup, no headaches.

1. **Clone & Go:**
   ```bash
   git clone https://github.com/your-username/InvoiceGenerator-main.git
   ```
2. **Serve it:** 
   Use any local web server (like VS Code Live Server) to enable full PWA features.
   ```bash
   # Or using python
   python3 -m http.server 8000
   ```
3. **Open:** `http://localhost:8000`

---

## 🛡️ Fort-Knox Privacy

**Your Invoices. Your Data.**
- **Zero-Server PDF Engine**: We use `pdfmake` to compile PDFs directly on your CPU. No sensitive financial data is ever transmitted to a third-party server to generate your documents.
- **LocalForage Storage**: Your profiles, items, and history live in your browser's IndexedDB. 
- **Opt-In Cloud**: Cloud sync is 100% optional. If you don't enable it, your data remains strictly local.

---

## 🛠️ The Architecture

Built for speed and resilience, utilizing modern web standards:
- **Core**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **UI Framework**: Bootstrap 5.3.2 (with customized glassmorphism and modern styling).
- **PDF Generation**: [pdfmake](http://pdfmake.org/)
- **Data Layer**: [localforage](https://localforage.github.io/localForage/) (IndexedDB)
- **Cloud Layer**: [Supabase](https://supabase.com/)

---

## 🤝 Join the Revolution

We believe business software should be free, fast, and beautiful. Want to help us make it even better?

1. **Fork it** and create your feature branch: `git checkout -b feature/NextBigThing`
2. **Commit** your brilliance: `git commit -m 'Added NextBigThing'`
3. **Push** to the branch: `git push origin feature/NextBigThing`
4. **Submit a Pull Request** 🚀

---

<div align="center">
  <p><i>Developed with ❤️ for Indian Small Businesses, Freelancers, and Hustlers.</i></p>
</div>
