(() => {
  'use strict';

  const REFERENCES = Object.freeze({
    kemenkes: Object.freeze({
      title: 'Kementerian Kesehatan RI — Buku Saku Pengobatan Malaria (2023)',
      url: 'https://malaria.kemkes.go.id/sites/default/files/2024-02/X_Cetak%20Buku%20Saku%20talak%20Des%202023F.pdf'
    }),
    whoGuidelines: Object.freeze({
      title: 'WHO Guidelines for Malaria — 13 August 2025',
      url: 'https://www.who.int/publications/i/item/guidelines-for-malaria/'
    }),
    whoDiagnostics: Object.freeze({
      title: 'WHO — Diagnostic testing for malaria',
      url: 'https://www.who.int/activities/diagnostic-testing-for-malaria'
    }),
    whoKnowlesi: Object.freeze({
      title: 'WHO — Expert meeting on control and elimination of Plasmodium knowlesi',
      url: 'https://www.who.int/publications/i/item/9789240094147'
    })
  });

  const GUIDANCE = Object.freeze({
    review: Object.freeze({
      title: 'Tinjau kandidat sel dan hasil classifier secara manual',
      summary: 'Evidence sistem belum memenuhi aturan minimum untuk pelaporan spesies. Jangan menetapkan spesies dari kelas dengan skor tertinggi saja.',
      points: Object.freeze([
        'Tinjau setiap bounding box, kualitas crop, temuan artefak, dan kecukupan lapang pandang.',
        'Konfirmasi keberadaan parasit, stadium, spesies, dan densitas melalui mikroskopi sesuai prosedur laboratorium.',
        'Ulangi akuisisi atau gunakan pemeriksaan rujukan bila citra tidak memadai atau bukti saling bertentangan.'
      ])
    }),
    no_parasite_detected: Object.freeze({
      title: 'Tidak ada box bukan berarti diagnosis malaria negatif',
      summary: 'Detector tidak menemukan kandidat parasit pada citra ini, tetapi parasitemia rendah, kualitas citra, atau lapang pandang yang tidak representatif tetap dapat menyebabkan parasit terlewat.',
      points: Object.freeze([
        'Jika kecurigaan klinis tetap ada, lanjutkan pemeriksaan mikroskopis dan/atau RDT sesuai pedoman.',
        'Tinjau preparat tipis dan tebal, kualitas pewarnaan, fokus, serta kecukupan lapang pandang.',
        'Jangan menuliskan “Normal” atau menyingkirkan malaria hanya dari keluaran ini.'
      ])
    }),
    normal: Object.freeze({
      title: 'Hasil model Normal tidak menyingkirkan malaria',
      summary: 'Indikator Normal berarti tidak ada parasit yang terdeteksi oleh YOLO, tetapi densitas parasit rendah, kualitas citra, atau lapang pandang yang tidak representatif tetap dapat memengaruhi hasil.',
      points: Object.freeze([
        'Jika kecurigaan klinis tetap ada, lanjutkan pemeriksaan mikroskopis dan/atau RDT sesuai pedoman.',
        'Tinjau preparat tipis dan tebal, kualitas pewarnaan, serta kecukupan lapang pandang.',
        'Jangan menunda evaluasi kondisi demam lain hanya berdasarkan keluaran model.'
      ])
    }),
    vivax: Object.freeze({
      title: 'Konfirmasi spesies dan temuan parasit secara manual',
      summary: 'Keluaran tertinggi mengarah ke Plasmodium vivax dan memerlukan identifikasi spesies yang berkualitas sebelum digunakan dalam keputusan klinis.',
      points: Object.freeze([
        'Konfirmasi keberadaan parasit, spesies, stadium, dan densitas melalui mikroskopi sesuai prosedur laboratorium.',
        'Korelasikan dengan riwayat paparan, perjalanan, episode malaria sebelumnya, dan manifestasi klinis.',
        'Gunakan pedoman nasional dan kebijakan institusi untuk evaluasi lanjutan; model tidak menentukan terapi.'
      ])
    }),
    knowlesi: Object.freeze({
      title: 'Prioritaskan konfirmasi dan penilaian klinis segera',
      summary: 'Plasmodium knowlesi dapat menyebabkan penyakit berat. Keluaran model memerlukan verifikasi spesies dan penilaian kondisi pasien tanpa penundaan.',
      points: Object.freeze([
        'Konfirmasi berbasis parasit dan minta tinjauan tenaga berpengalaman bila identifikasi spesies tidak pasti.',
        'Nilai tanda bahaya dan parameter keparahan sesuai protokol malaria berat yang berlaku.',
        'Pertimbangkan konteks paparan dan epidemiologi lokal; model tidak membedakan sumber atau jalur transmisi.'
      ])
    }),
    ovale: Object.freeze({
      title: 'Verifikasi spesies dan korelasikan dengan riwayat klinis',
      summary: 'Keluaran tertinggi mengarah ke Plasmodium ovale. Konfirmasi manual diperlukan karena spesies non-falciparum dapat sulit dibedakan hanya dari satu citra.',
      points: Object.freeze([
        'Tinjau morfologi parasit pada preparat berkualitas dan konfirmasi spesies melalui prosedur diagnostik yang tersedia.',
        'Korelasikan dengan riwayat perjalanan, paparan, dan episode demam atau malaria sebelumnya.',
        'Dokumentasikan ketidakpastian spesies dan rujuk sesuai prosedur laboratorium bila diperlukan.'
      ])
    }),
    malariae: Object.freeze({
      title: 'Konfirmasi spesies, stadium, dan densitas parasit',
      summary: 'Keluaran tertinggi mengarah ke Plasmodium malariae dan harus diverifikasi menggunakan pemeriksaan berbasis parasit yang berkualitas.',
      points: Object.freeze([
        'Lakukan pemeriksaan mikroskopis sistematis dan dokumentasikan spesies, stadium, serta densitas parasit.',
        'Korelasikan hasil dengan gejala, perjalanan penyakit, dan faktor risiko epidemiologis.',
        'Gunakan pemeriksaan rujukan bila identifikasi spesies atau kepadatan parasit belum meyakinkan.'
      ])
    }),
    falciparum: Object.freeze({
      title: 'Prioritaskan konfirmasi dan penilaian tanda bahaya',
      summary: 'Keluaran tertinggi mengarah ke Plasmodium falciparum. Konfirmasi parasitologis dan evaluasi keparahan perlu diprioritaskan.',
      points: Object.freeze([
        'Konfirmasi keberadaan parasit, spesies, stadium, dan densitas melalui mikroskopi berkualitas dan/atau RDT sesuai protokol.',
        'Nilai tanda bahaya serta kriteria malaria berat dan eskalasi sesuai prosedur klinis setempat.',
        'Jangan menggunakan skor confidence model untuk menentukan regimen atau dosis terapi.'
      ])
    })
  });

  function getDetectionStatus(score, threshold) {
    if (score >= threshold) return Object.freeze({ id: 'confident', label: 'Yakin', className: 'is-confident', description: `Skor tertinggi mencapai atau melewati threshold deteksi ${(threshold * 100).toFixed(0)}%.` });
    if (score >= 0.5) return Object.freeze({ id: 'less-confident', label: 'Kurang Yakin', className: 'is-less-confident', description: `Skor tertinggi berada antara 50% dan threshold deteksi ${(threshold * 100).toFixed(0)}%.` });
    return Object.freeze({ id: 'not-confident', label: 'Tidak Yakin', className: 'is-not-confident', description: 'Skor tertinggi berada di bawah 50% dan memerlukan tinjauan manual lebih lanjut.' });
  }

  function getModelSuggestion(top, detectionStatus) {
    if (detectionStatus.id !== 'confident') return `Perlu tinjauan manual — keluaran tertinggi ${top.label}`;
    return top.id === 'normal' ? 'Indikasi model: Normal' : `Suspek ${top.label}`;
  }

  function getDefaultConclusion(top, detectionStatus) {
    return getModelSuggestion(top, detectionStatus);
  }

  function getGuidance(top, detectionStatus) {
    const base = GUIDANCE[top.id] || GUIDANCE.review;
    const uncertainty = detectionStatus.id === 'confident' || ['review', 'no_parasite_detected'].includes(top.id) ? '' : `${detectionStatus.label}: kelas ${top.label} hanya merupakan keluaran tertinggi dan tidak boleh ditetapkan sebagai spesies tanpa konfirmasi. `;
    return Object.freeze({ title: base.title, summary: `${uncertainty}${base.summary}`, points: base.points });
  }

  function getReferences(top) {
    const references = [REFERENCES.kemenkes, REFERENCES.whoGuidelines, REFERENCES.whoDiagnostics];
    if (top.id === 'knowlesi') references.push(REFERENCES.whoKnowlesi);
    return references;
  }

  window.MesentericaClinical = Object.freeze({
    REFERENCES,
    GUIDANCE,
    getDetectionStatus,
    getModelSuggestion,
    getDefaultConclusion,
    getGuidance,
    getReferences
  });
})();
