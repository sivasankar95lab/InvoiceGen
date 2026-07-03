# 🧾 Invoice Generator

A professional, free, and easy-to-use **Indian Invoice Generator**. Built with a focus on speed, privacy, and GST compliance, it allows users to generate high-quality PDF invoices, challans, and quotations directly from their browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.0-green.svg)
![PWA](https://img.shields.io/badge/PWA-Advanced_Offline-orange.svg)
![Sync](https://img.shields.io/badge/Sync-Supabase_Cloud-blueviolet.svg)

---

## ✨ Key Features

- **GST Compliant**: Accurate support for CGST, SGST, and IGST calculations with automatic tax splitting.
- **Multiple Document Types**:
    - **Tax Invoice**: Standard GST invoice for B2B/B2C transactions.
    - **Simple Invoice**: Simplified billing for small businesses (non-tax).
    - **Delivery Challan**: For transport and delivery documentation accompanied by goods.
    - **Quotation**: Professional quotes/estimates for potential clients.
- **Advanced PWA Support**:
    - **Fully Offline**: Next-gen Service Worker (v11) provides robust offline capabilities with Stale-While-Revalidate caching for lightning-fast loads.
    - **Dynamic Caching**: Local fonts and CDNs are automatically cached for instant loading and offline stability.
- **Cloud Sync & Storage**:
    - **Supabase Integration**: Real-time cross-device synchronization with a Last-Write-Wins conflict resolution strategy.
    - **LocalForage Storage**: Migrated from `localStorage` to IndexedDB (`localforage`) for massively expanded storage limits without quotas.
- **User Experience (UX)**:
    - **Invoice Previews**: Full on-screen PDF preview modal before downloading.
    - **Custom Modals**: Replaced intrusive browser alerts with smooth Bootstrap-based confirmations and notifications.
    - **Dark Mode**: Integrated dark theme for low-light usage (now synced across devices!).
    - **Responsive Design**: Works perfectly on mobile, tablet, and desktop.
- **Powerful Tools**:
    - **Profile Management**: Save and manage multiple Company and Client profiles.
    - **Digital Signatures**: Draw your signature on-screen or upload an image.
    - **Amount in Words**: Automatic conversion of total amounts into Indian Rupees text.
    - **Error Logging**: Built-in system captures console errors for easier debugging.
- **Local-First Privacy & Sync**:
    - Generates PDFs entirely inside the browser.
    - Data is stored in your browser's IndexedDB. If connected, it seamlessly syncs to Supabase, giving you full control and portability over your business data.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Vanilla + Bootstrap 5.3.2), Vanilla JavaScript (ES6+).
- **PDF Generation**: [pdfmake](http://pdfmake.org/) for client-side PDF creation with custom layouts.
- **Storage & Sync**: [localforage](https://localforage.github.io/localForage/) for IndexedDB storage, and [Supabase](https://supabase.com/) for optional cloud syncing.
- **Icons**: Font Awesome 6.
- **Typography**: Outfit (Google Fonts) + Local Fallbacks.

---

## 🚀 Getting Started

### Prerequisites
- Any modern web browser (Chrome, Firefox, Edge, Safari).

### Running Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/InvoiceGenerator-main.git
   ```
2. Open `index.html` in your browser.

*Note: For full PWA capabilities (Service Worker) and Cloud Sync, it is recommended to serve the files via a local server (e.g., Live Server in VS Code) rather than opening the file directly.*

---

## 🛡️ Privacy & Security

The Invoice Generator follows a **local-first** approach augmented with secure cloud sync:
- **Client-Side Generation**: PDFs are generated entirely within your browser using JavaScript. No sensitive PDF data is sent to external servers for processing.
- **Secure Cross-Device Sync**: If enabled, your data is synced to a Supabase backend to allow you to roam seamlessly between devices. If disabled, data never leaves your browser's IndexedDB.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request for bug fixes or new features.

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Developed with ❤️ for Indian Small Businesses.
