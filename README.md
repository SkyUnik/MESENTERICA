# MESENTERICA

Prototipe lokal untuk membantu tinjauan citra apusan darah tipis. Sistem ini bukan diagnosis mandiri dan hasilnya belum siap digunakan sebagai perangkat medis tervalidasi.

## Sistem AI aktif

Inferensi produksi memakai Google LiteRT.js 2.5.0 tanpa TensorFlow.js:

1. YOLO11n detector mendeteksi satu kelas `infected_cell` pada tile 640×640 dengan overlap 20%.
2. YOLO11n-cls menilai crop 224×224 sebagai lima spesies atau `non_parasite`.
3. Agregator mengeluarkan `no_parasite_detected`, `species_uncertain`, `suspected_species`, atau `suspected_mixed`.

WebGPU dipilih terlebih dahulu dan LiteRT WASM menjadi fallback. WebNN sengaja tidak diaktifkan. Threshold detector dimulai dari default metadata `0,073152`. Perubahan slider menghitung ulang kasus aktif setelah jeda singkat, nilai aktual dicatat bersama setiap kasus, dan tombol simpan dapat mempertahankan pilihan threshold di browser untuk kunjungan berikutnya. Threshold classifier per kelas tetap berasal dari metadata. `non_parasite` menolak false-positive detector; aplikasi tidak lagi menghitung atau menampilkan `Normal = 1 - confidence`.

Jika seluruh prediksi spesies ditolak tetapi sedikitnya dua kandidat memberi kelas yang sama, aplikasi menampilkan evidence provisional dan pesan `Indikasi mengarah ke Plasmodium …—belum tervalidasi`. Kandidat tersebut tetap tidak dihitung sebagai sel spesies yang diterima dan outcome tetap `species_uncertain`.

## Menjalankan lokal

```sh
python3 -m http.server 4173
```

Buka `http://127.0.0.1:4173/`. Jangan membuka halaman melalui `file://`. Setelah satu pemuatan lengkap, service worker menyimpan aplikasi, model, dan runtime agar dapat dipakai offline.

## Privasi dan penyimpanan

- Gambar tidak diunggah oleh aplikasi dan inferensi tidak memerlukan request eksternal.
- Satu gambar tetap menjadi satu kasus.
- Batch laporan aktif disimpan sementara dalam `sessionStorage` memakai schema v3; pembaca laporan tetap menerima schema v2 sebagai arsip legacy.
- Data batch hilang ketika analisis direset atau tab ditutup.

## Artefak model

- `model/detector/model.tflite` — detector FP32, input `[1,3,640,640]`, output `[1,5,8400]`.
- `model/classifier/model.tflite` — classifier FP32, input `[1,3,224,224]`, output `[1,6]`.
- `model/manifest.json` — versi runtime/model dan jalur artefak.
- `model/*/metadata.json` — preprocessing, class order, threshold, tiling, dan NMS.
- `model/checksums.sha256` — checksum model, metadata, dan fixtures.
- `model/parity-fixtures.json` — kontrak tensor dan kasus agregasi deterministik tanpa challenge image.

## Berkas aplikasi

- `analysis.html` / `analysis.js` — upload, kamera, batch, dan dokumentasi klinisi.
- `yolo-inference.js` — preprocessing typed-array, LiteRT, tiled detector, crop classifier, NMS, dan aggregator.
- `clinical-guidance.js` — pesan tinjauan non-preskriptif.
- `report.html` / `report-state.js` — laporan schema v3 dan pembaca legacy v2.
- `service-worker.js` — cache offline versioned.
- `litert-self-test.html` — fixture lokal 25-run WebGPU/WASM; bukan bagian alur klinis.

## Status validasi

FP32 dipilih karena kandidat quantized tidak memenuhi seluruh batas recall, false-box, dan identitas keputusan. Challenge test terkunci masih menunjukkan kelemahan besar pada detector dan classifier spesies; hasil challenge tidak digunakan untuk memilih threshold atau mengubah model. Gunakan aplikasi hanya sebagai prototipe engineering dengan tinjauan mikroskopis wajib.
