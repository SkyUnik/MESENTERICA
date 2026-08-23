# MESENTERICA

Prototipe klinis statis untuk membantu klinisi meninjau satu atau beberapa citra apusan darah tipis menggunakan model klasifikasi TensorFlow.js yang berjalan lokal di browser. Setiap gambar menjadi satu kasus. Aplikasi ini merupakan bantuan triase dan dokumentasi, bukan perangkat diagnosis mandiri.

## Menjalankan secara lokal

Aplikasi harus dibuka melalui server HTTP agar berkas model dapat dimuat. Dari folder proyek, jalankan salah satu server statis, lalu buka `index.html` melalui alamat yang diberikan server.

Contoh dengan Python:

```sh
python3 -m http.server 4173
```

Kemudian buka `http://127.0.0.1:4173/`.

## Publikasi melalui GitHub Pages

1. Unggah seluruh isi folder ini ke root repositori GitHub. Pertahankan struktur folder `model/` dan `vendor/`.
2. Di GitHub, buka **Settings → Pages**.
3. Pada **Build and deployment**, pilih **Deploy from a branch**.
4. Pilih branch publikasi, biasanya `main`, dan folder `/ (root)`.
5. Simpan lalu tunggu alamat GitHub Pages tersedia.

Semua jalur aset bersifat relatif sehingga dapat berjalan dari domain pengguna maupun subdirektori proyek GitHub Pages. Jangan membuka `analysis.html` langsung melalui skema `file://`.

## Privasi dan penyimpanan

- Inferensi menggunakan berkas model lokal di `model/`.
- Gambar tidak diunggah oleh aplikasi.
- Hanya satu batch aktif disimpan dalam `sessionStorage` dengan kunci `mesenterica.currentBatch.v2`.
- Batch dapat memuat beberapa kasus dengan hubungan tetap satu gambar = satu kasus. Tidak ada riwayat batch.
- Bundel dihapus saat analisis direset atau ketika tab ditutup.
- Tidak ada riwayat kasus dan tidak ada server backend.

## Berkas utama

- `index.html` — beranda pemilihan alur.
- `analysis.html` — analisis batch, kamera live, navigator kasus, dan dokumentasi klinisi.
- `clinical-guidance.js` — status deteksi, panduan non-preskriptif, dan referensi bersama.
- `report.html` — laporan formal multi-kasus dengan cetak halaman aktif atau seluruh batch.
- `legacy_index.html` — beranda versi sebelumnya yang dipertahankan sebagai arsip desain.
- `archive/mockups/` — empat mockup HTML awal, disimpan hanya sebagai referensi desain.

Empat mockup awal tidak ditautkan dari aplikasi dan tidak termasuk jalur penggunaan resmi.

## Alur batch dan laporan

- Pilih beberapa PNG, JPEG, atau WebP (maksimum 10 MB per gambar), atau gunakan kamera live lalu capture setiap frame yang akan dijadikan kasus.
- Satu threshold deteksi berlaku untuk seluruh batch. Perubahannya hanya memperbarui status tampilan; probabilitas model tidak dihitung ulang atau diubah.
- Isi nama pemeriksa satu kali, tinjau dokumentasi setiap kasus, lalu centang pernyataan peninjauan sebelum menyiapkan laporan.
- Laporan dapat dicetak sebagai halaman kasus yang sedang terlihat atau sebagai seluruh batch. Pada cetak seluruh batch, setiap kasus dimulai pada halaman A4 baru.

Semua pemrosesan dan penyimpanan sementara dilakukan di browser. Pastikan kapasitas penyimpanan tab cukup ketika menambahkan banyak gambar.
