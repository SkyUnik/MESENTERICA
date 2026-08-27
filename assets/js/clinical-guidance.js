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

  const CONTENT = window.MesentericaGuidanceContent;
  const FALLBACK_GUIDANCE = Object.freeze({
    title: 'Tinjauan manual diperlukan',
    summary: 'Isi guidance untuk state ini belum tersedia.',
    points: Object.freeze([])
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

  function normalizeGuidance(value) {
    const base = value || FALLBACK_GUIDANCE;
    return Object.freeze({
      eyebrow: typeof CONTENT?.eyebrow === 'string' ? CONTENT.eyebrow : 'Prioritas tinjauan non-preskriptif',
      title: typeof base.title === 'string' ? base.title : FALLBACK_GUIDANCE.title,
      summary: typeof base.summary === 'string' ? base.summary : FALLBACK_GUIDANCE.summary,
      points: Object.freeze(Array.isArray(base.points) ? [...base.points] : [])
    });
  }

  function getSystemSpecies(systemResult, top) {
    const outcome = systemResult?.outcome;
    return outcome?.primarySpecies || top?.id || null;
  }

  function getGuidance(systemResult, top, detectionStatus) {
    const outcome = systemResult?.outcome;
    if (outcome?.code && CONTENT?.states?.[outcome.code]) {
      const state = CONTENT.states[outcome.code];
      let selected = state.default;
      if (outcome.code === 'suspected_mixed') {
        const combination = [outcome.primarySpecies, ...(outcome.secondarySpecies || [])].filter(Boolean).sort().join('+');
        selected = state.combinations?.[combination] || state.default;
      } else {
        selected = state.bySpecies?.[outcome.primarySpecies] || state.default;
      }
      return normalizeGuidance(selected);
    }

    const legacySpecies = CONTENT?.states?.suspected_species?.bySpecies?.[top?.id];
    const selected = CONTENT?.legacy?.[top?.id] || legacySpecies || CONTENT?.legacy?.review;
    const base = normalizeGuidance(selected);
    const uncertainty = detectionStatus?.id === 'confident' || ['review', 'normal'].includes(top?.id) ? '' : `${detectionStatus.label}: kelas ${top.label} hanya merupakan keluaran tertinggi dan tidak boleh ditetapkan sebagai spesies tanpa konfirmasi. `;
    return Object.freeze({ ...base, summary: `${uncertainty}${base.summary}` });
  }

  function getReferences(systemResult, top) {
    const references = [REFERENCES.kemenkes, REFERENCES.whoGuidelines, REFERENCES.whoDiagnostics];
    const outcome = systemResult?.outcome;
    const species = [getSystemSpecies(systemResult, top), ...(outcome?.secondarySpecies || [])];
    if (species.includes('knowlesi')) references.push(REFERENCES.whoKnowlesi);
    return references;
  }

  window.MesentericaClinical = Object.freeze({
    REFERENCES,
    GUIDANCE_CONTENT: CONTENT,
    getDetectionStatus,
    getModelSuggestion,
    getDefaultConclusion,
    getGuidance,
    getReferences
  });
})();
