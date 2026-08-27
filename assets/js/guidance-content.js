(() => {
  'use strict';

  /*
   * EDIT TEKS REPORT-GUIDANCE DI FILE INI.
   *
   * Warna global box diatur melalui `color`. Pilih salah satu:
   * `blue`, `yellow`, `green`, atau `red`.
   * Tambahkan `color` di dalam guidance tertentu untuk override per state/spesies.
   *
   * Setiap guidance memiliki:
   * - title: judul besar di dalam box
   * - summary: paragraf penjelasan
   * - points: daftar poin di bawah paragraf
   *
   * Nama state mengikuti keluaran sistem. Untuk state berbasis spesies,
   * edit entry di `bySpecies`. Untuk infeksi campuran, tambahkan override
   * opsional di `combinations` dengan nama spesies yang diurutkan alfabetis,
   * misalnya: `falciparum+vivax`.
   */
  window.MesentericaGuidanceContent = {
    eyebrow: 'Prioritas tinjauan non-preskriptif',
    color: 'blue',
    states: {
      no_parasite_detected: {
        default: {
          title: 'Tidak ada box bukan berarti diagnosis malaria negatif',
          summary: 'Detector tidak menemukan kandidat parasit pada citra ini, tetapi parasitemia rendah, kualitas citra, atau lapang pandang yang tidak representatif tetap dapat menyebabkan parasit terlewat.',
          points: [
            'Jika kecurigaan klinis tetap ada, lanjutkan pemeriksaan mikroskopis dan/atau RDT sesuai pedoman.',
            'Tinjau preparat tipis dan tebal, kualitas pewarnaan, fokus, serta kecukupan lapang pandang.',
            'Jangan menuliskan “Normal” atau menyingkirkan malaria hanya dari keluaran ini.'
          ]
        }
      },

      species_uncertain: {
        default: {
          title: 'Prioritaskan konfirmasi dan penilaian klinis segera',
          summary: 'Parasit mungkin terdeteksi, tetapi evidence sistem belum cukup atau saling bertentangan untuk menetapkan spesies.',
          points: [
            'Tinjau setiap bounding box, kualitas crop, temuan artefak, dan kecukupan lapang pandang.',
            'Konfirmasi keberadaan parasit, stadium, spesies, dan densitas melalui mikroskopi sesuai prosedur laboratorium.',
            'Ulangi akuisisi atau gunakan pemeriksaan rujukan bila citra tidak memadai atau bukti saling bertentangan.'
          ]
        },
        bySpecies: {
          vivax: {
            title: 'Konfirmasi indikasi Plasmodium vivax yang belum pasti',
            summary: 'Evidence sementara mengarah ke Plasmodium vivax, tetapi belum memenuhi aturan minimum untuk pelaporan spesies.',
            points: [
              'Konfirmasi morfologi, stadium, dan densitas parasit pada preparat berkualitas.',
              'Korelasikan dengan riwayat paparan, perjalanan, dan episode malaria sebelumnya.',
              'Pertahankan label spesies tidak pasti sampai bukti diagnostik memadai.'
            ]
          },
          knowlesi: {
            title: 'Prioritaskan konfirmasi dan penilaian klinis segera',
            summary: 'Evidence sementara mengarah ke Plasmodium knowlesi, tetapi spesies belum tervalidasi dan memerlukan verifikasi tanpa penundaan.',
            points: [
              'Minta tinjauan tenaga berpengalaman bila identifikasi spesies belum meyakinkan.',
              'Nilai tanda bahaya dan parameter keparahan sesuai protokol yang berlaku.',
              'Pertimbangkan konteks paparan dan epidemiologi lokal saat melakukan konfirmasi.'
            ]
          },
          ovale: {
            title: 'Verifikasi indikasi Plasmodium ovale yang belum pasti',
            summary: 'Evidence sementara mengarah ke Plasmodium ovale, tetapi belum cukup untuk menetapkan spesies.',
            points: [
              'Tinjau morfologi parasit pada preparat berkualitas dan konfirmasi melalui prosedur diagnostik yang tersedia.',
              'Korelasikan dengan riwayat perjalanan, paparan, dan episode demam atau malaria sebelumnya.',
              'Dokumentasikan ketidakpastian dan rujuk sesuai prosedur laboratorium bila diperlukan.'
            ]
          },
          malariae: {
            title: 'Verifikasi indikasi Plasmodium malariae yang belum pasti',
            summary: 'Evidence sementara mengarah ke Plasmodium malariae, tetapi belum memenuhi aturan minimum untuk pelaporan spesies.',
            points: [
              'Lakukan pemeriksaan mikroskopis sistematis dan dokumentasikan spesies, stadium, serta densitas parasit.',
              'Korelasikan hasil dengan gejala, perjalanan penyakit, dan faktor risiko epidemiologis.',
              'Gunakan pemeriksaan rujukan bila identifikasi spesies belum meyakinkan.'
            ]
          },
          falciparum: {
            title: 'Prioritaskan konfirmasi dan penilaian tanda bahaya',
            summary: 'Evidence sementara mengarah ke Plasmodium falciparum, tetapi spesies belum tervalidasi dan memerlukan konfirmasi segera.',
            points: [
              'Konfirmasi keberadaan parasit, spesies, stadium, dan densitas melalui pemeriksaan berkualitas.',
              'Nilai tanda bahaya serta kriteria malaria berat sesuai prosedur klinis setempat.',
              'Jangan menggunakan skor confidence model untuk menentukan regimen atau dosis terapi.'
            ]
          }
        }
      },

      suspected_species: {
        default: {
          title: 'Konfirmasi spesies dan temuan parasit secara manual',
          summary: 'Sedikitnya dua sel mendukung satu spesies, tetapi keluaran tetap merupakan hasil skrining model dan bukan diagnosis final.',
          points: [
            'Konfirmasi keberadaan parasit, spesies, stadium, dan densitas melalui prosedur laboratorium.',
            'Korelasikan hasil dengan temuan klinis dan epidemiologis.',
            'Gunakan pedoman nasional dan kebijakan institusi untuk evaluasi lanjutan.'
          ]
        },
        bySpecies: {
          vivax: {
            title: 'Konfirmasi spesies dan temuan Plasmodium vivax',
            summary: 'Keluaran agregat mengarah ke Plasmodium vivax dan memerlukan identifikasi spesies yang berkualitas sebelum digunakan dalam keputusan klinis.',
            points: [
              'Konfirmasi keberadaan parasit, spesies, stadium, dan densitas melalui mikroskopi sesuai prosedur laboratorium.',
              'Korelasikan dengan riwayat paparan, perjalanan, episode malaria sebelumnya, dan manifestasi klinis.',
              'Gunakan pedoman nasional dan kebijakan institusi untuk evaluasi lanjutan; model tidak menentukan terapi.'
            ]
          },
          knowlesi: {
            title: 'Prioritaskan konfirmasi dan penilaian klinis segera',
            summary: 'Keluaran agregat mengarah ke Plasmodium knowlesi. Verifikasi spesies dan penilaian kondisi pasien perlu dilakukan tanpa penundaan.',
            points: [
              'Konfirmasi berbasis parasit dan minta tinjauan tenaga berpengalaman bila identifikasi spesies tidak pasti.',
              'Nilai tanda bahaya dan parameter keparahan sesuai protokol malaria berat yang berlaku.',
              'Pertimbangkan konteks paparan dan epidemiologi lokal; model tidak membedakan sumber atau jalur transmisi.'
            ]
          },
          ovale: {
            title: 'Verifikasi spesies dan korelasikan dengan riwayat klinis',
            summary: 'Keluaran agregat mengarah ke Plasmodium ovale. Konfirmasi manual diperlukan karena spesies non-falciparum dapat sulit dibedakan hanya dari satu citra.',
            points: [
              'Tinjau morfologi parasit pada preparat berkualitas dan konfirmasi spesies melalui prosedur diagnostik yang tersedia.',
              'Korelasikan dengan riwayat perjalanan, paparan, dan episode demam atau malaria sebelumnya.',
              'Dokumentasikan ketidakpastian spesies dan rujuk sesuai prosedur laboratorium bila diperlukan.'
            ]
          },
          malariae: {
            title: 'Konfirmasi spesies, stadium, dan densitas parasit',
            summary: 'Keluaran agregat mengarah ke Plasmodium malariae dan harus diverifikasi menggunakan pemeriksaan berbasis parasit yang berkualitas.',
            points: [
              'Lakukan pemeriksaan mikroskopis sistematis dan dokumentasikan spesies, stadium, serta densitas parasit.',
              'Korelasikan hasil dengan gejala, perjalanan penyakit, dan faktor risiko epidemiologis.',
              'Gunakan pemeriksaan rujukan bila identifikasi spesies atau kepadatan parasit belum meyakinkan.'
            ]
          },
          falciparum: {
            title: 'Prioritaskan konfirmasi dan penilaian tanda bahaya',
            summary: 'Keluaran agregat mengarah ke Plasmodium falciparum. Konfirmasi parasitologis dan evaluasi keparahan perlu diprioritaskan.',
            points: [
              'Konfirmasi keberadaan parasit, spesies, stadium, dan densitas melalui mikroskopi berkualitas dan/atau RDT sesuai protokol.',
              'Nilai tanda bahaya serta kriteria malaria berat dan eskalasi sesuai prosedur klinis setempat.',
              'Jangan menggunakan skor confidence model untuk menentukan regimen atau dosis terapi.'
            ]
          }
        }
      },

      suspected_mixed: {
        default: {
          title: 'Konfirmasi dugaan infeksi campuran secara manual',
          summary: 'Evidence agregat mendukung lebih dari satu spesies Plasmodium. Semua spesies yang dilaporkan perlu diverifikasi sebelum digunakan dalam keputusan klinis.',
          points: [
            'Tinjau kembali seluruh sel pendukung dan singkirkan artefak atau duplikasi deteksi.',
            'Konfirmasi setiap spesies, stadium, dan densitas melalui pemeriksaan berbasis parasit yang berkualitas.',
            'Dokumentasikan konflik atau ketidakpastian dan gunakan pemeriksaan rujukan bila diperlukan.'
          ]
        },
        combinations: {
          // Contoh override manual:
          // 'falciparum+vivax': { title: '...', summary: '...', points: ['...', '...'] }
        }
      }
    },

    legacy: {
      review: {
        title: 'Tinjau kandidat sel dan hasil classifier secara manual',
        summary: 'Evidence sistem belum memenuhi aturan minimum untuk pelaporan spesies. Jangan menetapkan spesies dari kelas dengan skor tertinggi saja.',
        points: [
          'Tinjau setiap bounding box, kualitas crop, temuan artefak, dan kecukupan lapang pandang.',
          'Konfirmasi keberadaan parasit, stadium, spesies, dan densitas melalui mikroskopi sesuai prosedur laboratorium.',
          'Ulangi akuisisi atau gunakan pemeriksaan rujukan bila citra tidak memadai atau bukti saling bertentangan.'
        ]
      },
      normal: {
        title: 'Hasil model Normal tidak menyingkirkan malaria',
        summary: 'Indikator Normal berarti tidak ada parasit yang terdeteksi oleh model legacy, tetapi densitas rendah, kualitas citra, atau lapang pandang yang tidak representatif tetap dapat memengaruhi hasil.',
        points: [
          'Jika kecurigaan klinis tetap ada, lanjutkan pemeriksaan mikroskopis dan/atau RDT sesuai pedoman.',
          'Tinjau preparat tipis dan tebal, kualitas pewarnaan, serta kecukupan lapang pandang.',
          'Jangan menunda evaluasi kondisi demam lain hanya berdasarkan keluaran model.'
        ]
      }
    }
  };
})();
