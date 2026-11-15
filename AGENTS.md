# ACTIS Repository Rules — Release & Changelog Wajib

Aturan wajib untuk setiap perubahan atau penambahan fitur di repositori ACTIS (berlaku untuk update via GitHub `git pull && docker compose up -d --build actis-app` maupun file `.zip`):

1. **Selalu Catat Log Perubahan & Bump Versi**:
   - Setiap kali mengubah, memperbaiki, atau menambahkan fitur sebelum melakukan `git commit`, `git push`, atau membuat paket `.zip`, **WAJIB** memperbarui:
     - `package.json` (`"version"` dinaikkan ke versi baru secara berurutan).
     - `CHANGELOG.json` (tambahkan objek rilis baru di urutan paling atas array `releases` dengan field `"version"`, `"date"` berformat ISO-8601 lengkap WIB `YYYY-MM-DDTHH:mm:ss+07:00`, `"title"`, dan daftar `"changes"` berkategori `feat` / `fix` / `improve` / `security`).
   - Dapat menggunakan helper CLI:
     ```sh
     npm run release:log -- --version=1.x.y --title="Judul Perubahan" --feat="Poin fitur" --fix="Poin perbaikan"
     ```
2. **Sinkronisasi Metadata Build**:
   - Pastikan `npm run sync:build-info` (atau `npm run build` / `npm run release:zip`) dijalankan sehingga `build-info.json` memiliki `sourceDigest`, `buildSignature`, dan waktu build terbaru.
3. **Verifikasi**:
   - Sebelum commit/push, jalankan minimal `npx tsc --noEmit` dan `npm run build` agar update dari GitHub maupun File `.zip` dipastikan siap deploy tanpa error.
