import { loadTwoStage } from './yolo-inference.js?v=20260826.4';

(() => {
  'use strict';

  const MANIFEST_URL = new URL('model/manifest.json?v=20260826.4', document.baseURI).href;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const STORAGE_KEY = 'mesenterica.currentBatch.v2';
  const LEGACY_STORAGE_KEY = 'mesenterica.currentCase.v1';
  const CAPACITY_PROBE_KEY = 'mesenterica.capacityProbe';
  const SAVED_THRESHOLD_KEY = 'mesenterica.detectorThreshold.v1';
  const LIVE_INTERVAL_MS = 200;
  const THRESHOLD_RERUN_DELAY_MS = 350;
  const REPORT_PREVIEW_MAX_DIMENSION = 1400;
  const REPORT_PREVIEW_FALLBACK_DIMENSION = 1000;
  const REPORT_PREVIEW_MAX_DATA_LENGTH = 2500000;
  const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const LABELS = [
    { id: 'vivax', label: 'Plasmodium vivax' },
    { id: 'knowlesi', label: 'Plasmodium knowlesi' },
    { id: 'ovale', label: 'Plasmodium ovale' },
    { id: 'malariae', label: 'Plasmodium malariae' },
    { id: 'falciparum', label: 'Plasmodium falciparum' }
  ];

  const elements = {
    body: document.body,
    modeBadge: document.getElementById('mode-badge'), workflowDescription: document.getElementById('workflow-description'),
    workflowStepper: document.getElementById('workflow-stepper'), reportSection: document.getElementById('report-section'),
    reportLockedState: document.getElementById('report-locked-state'), continueReport: document.getElementById('continue-report'),
    clinicalReview: document.getElementById('clinical-review'), reviewModelSuggestion: document.getElementById('review-model-suggestion'),
    caseId: document.getElementById('case-id'), examinedAt: document.getElementById('examined-at'),
    examiner: document.getElementById('examiner'), clinicianConclusion: document.getElementById('clinician-conclusion'),
    caseNotes: document.getElementById('case-notes'), acknowledgement: document.getElementById('review-acknowledgement'),
    prepareReport: document.getElementById('prepare-report'), caseSaveStatus: document.getElementById('case-save-status'),
    dropZone: document.getElementById('drop-zone'), chooseFile: document.getElementById('choose-file'),
    chooseCamera: document.getElementById('choose-camera'), fileInput: document.getElementById('file-input'),
    cameraInput: document.getElementById('camera-input'), batchStatus: document.getElementById('batch-status'),
    imageSelection: document.getElementById('image-selection'), selectedImage: document.getElementById('selected-image'),
    selectedFilename: document.getElementById('selected-filename'), selectedFilemeta: document.getElementById('selected-filemeta'),
    imageCounter: document.getElementById('image-counter'), previousImage: document.getElementById('previous-image'),
    nextImage: document.getElementById('next-image'), addImages: document.getElementById('add-images'),
    removeCase: document.getElementById('remove-case'), resetAnalysis: document.getElementById('reset-analysis'),
    cameraWorkspace: document.getElementById('camera-workspace'), cameraVideo: document.getElementById('camera-video'),
    cameraCaptureCount: document.getElementById('camera-capture-count'), captureImage: document.getElementById('capture-image'),
    closeCamera: document.getElementById('close-camera'), captureGallery: document.getElementById('camera-capture-gallery'),
    captureGalleryCount: document.getElementById('camera-capture-gallery-count'), captureList: document.getElementById('camera-capture-list'),
    alert: document.getElementById('analysis-alert'),
    alertText: document.getElementById('analysis-alert-text'), retry: document.getElementById('model-retry'),
    modelState: document.getElementById('model-state'), resultEmpty: document.getElementById('result-empty'),
    resultLoading: document.getElementById('result-loading'), resultOutput: document.getElementById('result-output'),
    suggestionLabel: document.getElementById('suggestion-label'), suggestionTitle: document.getElementById('suggestion-title'),
    suggestionDetail: document.getElementById('suggestion-detail'), resultConfidence: document.getElementById('result-confidence'),
    probabilityList: document.getElementById('probability-list'), analysisDuration: document.getElementById('analysis-duration'),
    threshold: document.getElementById('threshold'), thresholdValue: document.getElementById('threshold-value'), thresholdReset: document.getElementById('threshold-reset'), thresholdSave: document.getElementById('threshold-save'),
    detectionCard: document.getElementById('detection-status-card'), detectionTitle: document.getElementById('detection-status-title'),
    detectionDescription: document.getElementById('detection-status-description'), analysisGuidance: document.getElementById('analysis-guidance'),
    guidanceTitle: document.getElementById('analysis-guidance-title'), guidanceSummary: document.getElementById('analysis-guidance-summary'),
    guidancePoints: document.getElementById('analysis-guidance-points'), referenceList: document.getElementById('analysis-reference-list'),
    previousDocumentation: document.getElementById('previous-documentation'), nextDocumentation: document.getElementById('next-documentation'),
    documentationCounter: document.getElementById('documentation-counter'), autofillAll: document.getElementById('autofill-all'),
    autofillDialog: document.getElementById('autofill-dialog'), cancelAutofill: document.getElementById('cancel-autofill'),
    confirmAutofill: document.getElementById('confirm-autofill')
  };

  let model = null;
  let modelPromise = null;
  let modelMetadata = null;
  let cases = [];
  let activeCaseIndex = -1;
  let caseSequence = 0;
  let processingFiles = false;
  let cameraStream = null;
  let cameraLoopId = 0;
  let cameraSessionToken = 0;
  let livePredictionInFlight = false;
  let livePredictionPaused = false;
  let lastLivePredictionAt = 0;
  let lastLiveResults = null;
  let lastLiveSystemResult = null;
  let batchCreatedAt = new Date().toISOString();
  let batchExaminer = '';
  let renderingDocumentation = false;
  let previewRenderToken = 0;
  let detectorThresholdDefault = 0.073152;
  let savedDetectorThreshold = null;
  let thresholdRerunTimer = 0;
  let thresholdRerunToken = 0;
  let thresholdReprocessing = false;

  function configureMode() {
    const mode = new URLSearchParams(window.location.search).get('mode') === 'report' ? 'report' : 'quick';
    elements.body.dataset.analysisMode = mode;
    if (mode === 'report') {
      elements.modeBadge.textContent = 'Analisis & Laporan';
      elements.workflowDescription.textContent = 'Analisis satu atau beberapa gambar; dokumentasi klinis tersedia setelah hasil ditinjau.';
      elements.reportSection.hidden = false;
    } else {
      elements.modeBadge.textContent = 'Analisis Cepat';
      elements.workflowDescription.textContent = 'Unggah beberapa gambar dan tinjau setiap keluaran model tanpa membuat laporan.';
      elements.reportSection.hidden = true;
      elements.workflowStepper.classList.add('quick-mode-stepper');
    }
  }

  function setModelState(state, text) { elements.modelState.dataset.state = state; elements.modelState.textContent = text; }
  function setBatchStatus(message = '') { elements.batchStatus.textContent = message; }
  function setResultView(view) {
    elements.resultEmpty.hidden = view !== 'empty'; elements.resultLoading.hidden = view !== 'loading'; elements.resultOutput.hidden = view !== 'output';
  }
  function showAlert(message, allowRetry = false) {
    elements.alertText.textContent = message; elements.alert.hidden = false; elements.retry.hidden = !allowRetry;
  }
  function hideAlert() { elements.alert.hidden = true; elements.retry.hidden = true; elements.alertText.textContent = ''; }

  function formatThreshold(value) { return Number(value).toFixed(6).replace('.', ','); }
  function updateThresholdDisplay() {
    const current = Number(elements.threshold.value); const isDefault = Math.abs(current - detectorThresholdDefault) < 1e-9;
    const isSaved = Number.isFinite(savedDetectorThreshold) && Math.abs(current - savedDetectorThreshold) < 1e-9;
    elements.thresholdValue.textContent = `${formatThreshold(current)}${isSaved ? ' · tersimpan' : (isDefault ? ' · default' : ' · belum disimpan')}`;
    elements.thresholdReset.disabled = isDefault || elements.threshold.disabled;
    elements.thresholdSave.disabled = isSaved || elements.threshold.disabled;
  }
  function loadSavedThreshold() {
    try {
      const value = Number(localStorage.getItem(SAVED_THRESHOLD_KEY));
      return Number.isFinite(value) && value >= Number(elements.threshold.min) && value <= Number(elements.threshold.max) ? value : null;
    } catch { return null; }
  }
  function configureThreshold(metadata) {
    detectorThresholdDefault = Number(metadata?.detector?.candidateThreshold || 0.073152);
    savedDetectorThreshold = loadSavedThreshold();
    elements.threshold.value = String(savedDetectorThreshold ?? detectorThresholdDefault); elements.threshold.disabled = false; updateThresholdDisplay();
  }
  function saveThresholdPreference() {
    const current = Number(elements.threshold.value);
    try {
      localStorage.setItem(SAVED_THRESHOLD_KEY, String(current)); savedDetectorThreshold = current; updateThresholdDisplay();
      setBatchStatus(`Threshold detector ${formatThreshold(current)} disimpan untuk kunjungan berikutnya.`);
    } catch { showAlert('Threshold tidak dapat disimpan oleh browser ini. Nilainya tetap berlaku selama halaman masih terbuka.'); }
  }

  async function loadModel() {
    hideAlert(); setModelState('loading', 'Memuat model lokal…');
    modelPromise = loadTwoStage(MANIFEST_URL).then((loadedModel) => {
      model = loadedModel; modelMetadata = loadedModel.metadata; configureThreshold(modelMetadata);
      const runtime = loadedModel.runtime.mixedExecution ? `${loadedModel.runtime.accelerator}+WASM` : loadedModel.runtime.accelerator;
      setModelState('ready', `LiteRT siap · ${runtime} · detector + 6 kelas`); return loadedModel;
    }).catch((error) => {
      model = null; setModelState('error', 'Model gagal dimuat');
      showAlert('Model lokal tidak dapat dimuat. Pastikan halaman dibuka melalui server web dan folder model tetap lengkap.', true); throw error;
    });
    return modelPromise;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  function validateFile(file) {
    if (!file) throw new Error('Tidak ada gambar yang dipilih.');
    if (!ALLOWED_TYPES.has(file.type)) throw new Error('Format tidak didukung; gunakan PNG, JPEG, atau WebP.');
    if (file.size > MAX_FILE_SIZE) throw new Error('Ukuran melebihi batas 10 MB.');
  }
  function decodeImage(image) {
    if (typeof image.decode === 'function') return image.decode();
    return new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
  }
  async function loadImageFromFile(file) {
    const objectUrl = URL.createObjectURL(file); const image = new Image(); image.decoding = 'async'; image.src = objectUrl;
    try { await decodeImage(image); if (!image.naturalWidth || !image.naturalHeight) throw new Error(); return { image, objectUrl }; }
    catch { URL.revokeObjectURL(objectUrl); throw new Error('Berkas tidak dapat dibaca sebagai gambar yang valid.'); }
  }
  function mapPredictions(systemResult) {
    const evidence = systemResult.displaySpeciesEvidence || systemResult.speciesEvidence;
    const mapped = LABELS.map((definition) => ({ ...definition, score: Number(evidence?.[definition.id] || 0) }));
    if (mapped.some((item) => !Number.isFinite(item.score) || item.score < 0 || item.score > 1)) throw new Error('Keluaran evidence spesies tidak valid.');
    return mapped;
  }
  async function predictSource(source) {
    const systemResult = await (model || await modelPromise).predict(source, { candidateThreshold: Number(elements.threshold.value) });
    return { results: mapPredictions(systemResult), systemResult, detections: systemResult.cells };
  }

  function makeReportPreview(source, detections) {
    let canvas = model.drawBoxes(source, { cells: detections }, { maxDimension: REPORT_PREVIEW_MAX_DIMENSION });
    let preview = canvas.toDataURL('image/jpeg', 0.82);
    if (preview.length > REPORT_PREVIEW_MAX_DATA_LENGTH) {
      canvas = model.drawBoxes(source, { cells: detections }, { maxDimension: REPORT_PREVIEW_FALLBACK_DIMENSION });
      preview = canvas.toDataURL('image/jpeg', 0.72);
    }
    return preview;
  }
  function capacityProbe(candidateCases) {
    const probe = { version: 3, createdAt: batchCreatedAt, activeCaseIndex, examiner: batchExaminer,
      cases: candidateCases.map((item) => ({ caseKey: item.caseKey, sequence: item.sequence, image: item.image,
        inference: { schemaVersion: 'mesenterica-case-result-v3', modelName: modelMetadata?.manifest?.manifestVersion || 'MESENTERICA LiteRT v3', analysedAt: item.analysedAt, probabilities: item.results, systemResult: item.systemResult }, documentation: item.documentation })) };
    try { sessionStorage.setItem(CAPACITY_PROBE_KEY, JSON.stringify(probe)); sessionStorage.removeItem(CAPACITY_PROBE_KEY); return true; }
    catch { sessionStorage.removeItem(CAPACITY_PROBE_KEY); return false; }
  }
  function makeCaseKey(sequence) { return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `case-${Date.now()}-${sequence}`; }

  function localTimestampParts(value) {
    const date = new Date(value); const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }
  function automaticCaseId(analysedAt, sequence) { return `KASUS-${localTimestampParts(analysedAt)}-${sequence}`; }
  function resultsTop(results) { return [...results].sort((a, b) => b.score - a.score)[0]; }
  function detectionForSystem(systemResult) {
    const isSuspect = ['suspected_species', 'suspected_mixed'].includes(systemResult?.outcome?.code);
    return isSuspect
      ? { id: 'confident', label: 'Suspek berbasis ≥2 sel', className: 'is-confident', description: systemResult.outcome.reason }
      : { id: 'not-confident', label: 'Tinjauan manual', className: 'is-not-confident', description: systemResult?.outcome?.reason || 'Keluaran belum mencukupi aturan agregasi.' };
  }
  function defaultConclusion(results, systemResult) { return systemResult?.outcome?.message || `Tinjau manual — evidence tertinggi ${resultsTop(results).label}`; }
  function makeDocumentation(results, systemResult, analysedAt, sequence) {
    return { caseId: automaticCaseId(analysedAt, sequence), examinedAt: toLocalDateTimeValue(new Date(analysedAt)), clinicianConclusion: defaultConclusion(results, systemResult), notes: '', conclusionWasEdited: false };
  }

  async function createCaseFromFile(file, source) {
    validateFile(file); const { image, objectUrl } = await loadImageFromFile(file); const startedAt = performance.now();
    try {
      const prediction = await predictSource(image); const results = prediction.results; const width = image.naturalWidth; const height = image.naturalHeight; const sequence = caseSequence + 1;
      const analysedAt = new Date().toISOString();
      return { caseKey: makeCaseKey(sequence), sequence,
        image: { filename: file.name || `kamera-${sequence}.jpg`, mimeType: file.type, width, height, size: file.size, reportPreview: makeReportPreview(image, prediction.detections) },
        sourceFile: file, results, systemResult: prediction.systemResult, analysedAt, duration: Math.round(performance.now() - startedAt), origin: source, documentation: makeDocumentation(results, prediction.systemResult, analysedAt, sequence) };
    } finally { URL.revokeObjectURL(objectUrl); }
  }
  function renderCapturedGallery() {
    const capturedCases = cases.filter((item) => item.origin === 'camera'); elements.captureList.replaceChildren();
    elements.captureGallery.hidden = capturedCases.length === 0; elements.captureGalleryCount.textContent = `${capturedCases.length} gambar`;
    capturedCases.forEach((item, index) => {
      const figure = document.createElement('figure'); figure.className = 'camera-capture-item';
      if (item.caseKey === getActiveCase()?.caseKey) figure.classList.add('is-latest');
      const image = document.createElement('img'); image.src = item.image.reportPreview; image.alt = `Hasil capture ${index + 1}: ${item.image.filename}`;
      const caption = document.createElement('figcaption'); const label = document.createElement('strong'); label.textContent = `Capture ${index + 1}`;
      const detail = document.createElement('span'); detail.textContent = `Kasus ${cases.indexOf(item) + 1} · ${item.image.width}×${item.image.height}`;
      caption.append(label, detail); figure.append(image, caption); elements.captureList.append(figure);
    });
  }
  async function addFileAsCase(file, source = 'upload') {
    const candidate = await createCaseFromFile(file, source);
    if (!capacityProbe([...cases, candidate])) throw new Error('Kapasitas penyimpanan tab tidak cukup. Cetak atau reset batch sebelum menambah kasus lagi.');
    caseSequence = candidate.sequence; cases.push(candidate); activeCaseIndex = cases.length - 1; sessionStorage.removeItem(STORAGE_KEY);
    if (source === 'camera' && cameraStream) {
      renderResults(candidate.results, candidate.duration, false, candidate.systemResult);
      renderCapturedGallery();
      elements.cameraCaptureCount.textContent = `${cases.filter((item) => item.origin === 'camera').length} gambar kamera tersimpan · frame terakhir berhasil dicapture`;
    } else renderActiveCase();
    return candidate;
  }
  async function handleFiles(fileList, source = 'upload') {
    const files = Array.from(fileList || []); if (!files.length || processingFiles) return;
    processingFiles = true; hideAlert(); setResultView('loading'); elements.captureImage.disabled = true; elements.threshold.disabled = true; updateThresholdDisplay();
    const failures = []; let accepted = 0;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]; setBatchStatus(`Memproses gambar ${index + 1} dari ${files.length}: ${file.name || 'gambar kamera'}…`);
      try { await addFileAsCase(file, source); accepted += 1; }
      catch (error) { failures.push(`${file.name || 'Gambar'}: ${error.message}`); if (error.message.includes('Kapasitas penyimpanan')) break; }
    }
    processingFiles = false; elements.captureImage.disabled = false; elements.threshold.disabled = false; updateThresholdDisplay(); elements.fileInput.value = ''; elements.cameraInput.value = '';
    setBatchStatus(`${accepted} gambar ditambahkan · ${cases.length} kasus dalam batch${failures.length ? ` · ${failures.length} ditolak` : ''}.`);
    if (failures.length) showAlert(failures.join(' '));
    if (!cameraStream) { if (cases.length) renderActiveCase(); else setResultView('empty'); }
  }

  function getActiveCase() { return activeCaseIndex >= 0 ? cases[activeCaseIndex] : null; }
  function scheduleThresholdRerun() {
    window.clearTimeout(thresholdRerunTimer); thresholdRerunToken += 1;
    if (cameraStream) { setBatchStatus(`Threshold ${formatThreshold(elements.threshold.value)} langsung dipakai pada prediksi kamera berikutnya.`); return; }
    const activeCase = getActiveCase();
    if (!activeCase?.sourceFile) { setBatchStatus(`Threshold ${formatThreshold(elements.threshold.value)} akan dipakai pada analisis berikutnya.`); return; }
    const token = thresholdRerunToken;
    setBatchStatus(`Threshold ${formatThreshold(elements.threshold.value)} dipilih. Menunggu slider berhenti…`);
    thresholdRerunTimer = window.setTimeout(() => { void reprocessActiveCase(token); }, THRESHOLD_RERUN_DELAY_MS);
  }
  async function reprocessActiveCase(token) {
    const activeCase = getActiveCase();
    if (!activeCase?.sourceFile || processingFiles || thresholdReprocessing || token !== thresholdRerunToken) return;
    const caseKey = activeCase.caseKey; thresholdReprocessing = true; elements.threshold.disabled = true; updateThresholdDisplay();
    setBatchStatus(`Menghitung ulang ${activeCase.image.filename} dengan threshold ${formatThreshold(elements.threshold.value)}…`);
    const startedAt = performance.now(); let objectUrl = '';
    try {
      const loaded = await loadImageFromFile(activeCase.sourceFile); objectUrl = loaded.objectUrl;
      const prediction = await predictSource(loaded.image);
      if (token !== thresholdRerunToken || getActiveCase()?.caseKey !== caseKey) return;
      activeCase.results = prediction.results; activeCase.systemResult = prediction.systemResult;
      activeCase.duration = Math.round(performance.now() - startedAt); activeCase.analysedAt = new Date().toISOString();
      activeCase.image.reportPreview = makeReportPreview(loaded.image, prediction.detections);
      if (!activeCase.documentation.conclusionWasEdited) activeCase.documentation.clinicianConclusion = defaultConclusion(activeCase.results, activeCase.systemResult);
      sessionStorage.removeItem(STORAGE_KEY); renderActiveCase();
      setBatchStatus(`Kasus aktif diperbarui dengan threshold ${formatThreshold(elements.threshold.value)}.`);
    } catch (error) {
      showAlert(`Kasus tidak dapat dihitung ulang. ${error.message || 'Coba pilih gambar kembali.'}`);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      thresholdReprocessing = false; elements.threshold.disabled = false; updateThresholdDisplay();
    }
  }
  function getPresentationSummary(results, systemResult) {
    if (!results) return null; const top = resultsTop(results); const detection = detectionForSystem(systemResult);
    return { top, detection, title: systemResult?.outcome?.message || 'Tinjauan manual diperlukan', detail: systemResult?.outcome?.reason || detection.description };
  }
  function renderGuidance(results, systemResult) {
    const evidenceTop = resultsTop(results); const outcome = systemResult?.outcome;
    const top = outcome?.code === 'no_parasite_detected' ? { id: 'no_parasite_detected', label: 'Tidak ada box' } :
      (outcome?.primarySpecies ? evidenceTop : { id: 'review', label: 'Tinjauan manual' });
    const detection = detectionForSystem(systemResult); const guidance = window.MesentericaClinical.getGuidance(top, detection);
    elements.guidanceTitle.textContent = guidance.title; elements.guidanceSummary.textContent = guidance.summary; elements.guidancePoints.replaceChildren();
    guidance.points.forEach((point) => { const item = document.createElement('li'); item.textContent = point; elements.guidancePoints.append(item); });
    elements.referenceList.replaceChildren();
    window.MesentericaClinical.getReferences(top).forEach((reference) => {
      const item = document.createElement('li'); const link = document.createElement('a'); link.href = reference.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = reference.title; item.append(link); elements.referenceList.append(item);
    });
    elements.analysisGuidance.hidden = false;
  }
  function renderResults(results, duration, isLive = false, systemResult = null) {
    if (!results) return; const sorted = [...results].sort((a, b) => b.score - a.score); const summary = getPresentationSummary(results, systemResult);
    elements.resultOutput.classList.remove('is-review', 'is-normal', 'is-suspect', 'is-confident', 'is-less-confident', 'is-not-confident'); elements.resultOutput.classList.add(summary.detection.className);
    elements.suggestionLabel.textContent = isLive ? 'Pratinjau kamera · belum disimpan' : 'Indikasi model'; elements.suggestionTitle.textContent = summary.title;
    elements.suggestionDetail.textContent = isLive ? `${summary.detail} Tekan “Capture Gambar” untuk menyimpan frame ini sebagai kasus.` : summary.detail;
    const acceptedCells = systemResult?.counts?.acceptedSpeciesCells || 0; const candidateCells = systemResult?.counts?.candidateSpeciesCells || 0;
    elements.resultConfidence.textContent = acceptedCells ? `${acceptedCells} sel diterima` : (candidateCells ? `${candidateCells} kandidat spesies · belum diterima` : '0 sel diterima');
    if (!isLive) elements.reviewModelSuggestion.textContent = summary.title;
    const runtime = systemResult?.runtime?.accelerator ? ` · ${systemResult.runtime.accelerator}` : '';
    const appliedThreshold = systemResult?.thresholds?.detectorCandidate; const thresholdText = Number.isFinite(appliedThreshold) ? ` · threshold ${formatThreshold(appliedThreshold)}` : '';
    elements.analysisDuration.textContent = isLive ? `Prediksi live lokal${runtime}${thresholdText}` : `Kasus ${activeCaseIndex + 1} dari ${cases.length} · diproses ${duration} ms${runtime}${thresholdText}`;
    elements.probabilityList.replaceChildren();
    sorted.forEach((item, index) => {
      const row = document.createElement('div'); row.className = `probability-row${index === 0 ? ' is-top' : ''}`;
      const heading = document.createElement('div'); heading.className = 'probability-row-heading'; const name = document.createElement('span'); name.textContent = item.label;
      const value = document.createElement('strong'); value.textContent = `${(item.score * 100).toFixed(1)}%`; heading.append(name, value);
      const track = document.createElement('div'); track.className = 'probability-track'; const bar = document.createElement('span'); bar.className = 'probability-bar'; bar.style.width = `${Math.max(0.5, item.score * 100)}%`; track.append(bar);
      row.append(heading, track); elements.probabilityList.append(row);
    });
    elements.detectionCard.classList.remove('is-confident', 'is-less-confident', 'is-not-confident'); elements.detectionCard.classList.add(summary.detection.className);
    elements.detectionTitle.textContent = summary.detection.label; elements.detectionDescription.textContent = summary.detection.description;
    renderGuidance(results, systemResult);
    setResultView('output');
  }
  async function renderSelectedPreview(caseItem) {
    const token = ++previewRenderToken; const preview = new Image(); preview.decoding = 'async'; preview.src = caseItem.image.reportPreview;
    try {
      await decodeImage(preview);
      if (token !== previewRenderToken || getActiveCase()?.caseKey !== caseItem.caseKey) return;
      elements.selectedImage.width = preview.naturalWidth; elements.selectedImage.height = preview.naturalHeight;
      const context = elements.selectedImage.getContext('2d', { alpha: false });
      context.clearRect(0, 0, elements.selectedImage.width, elements.selectedImage.height);
      context.drawImage(preview, 0, 0);
      elements.selectedImage.setAttribute('aria-label', `Citra ${caseItem.image.filename} dengan bounding box hasil YOLO`);
    } catch {
      if (token === previewRenderToken) showAlert('Pratinjau bounding box tidak dapat ditampilkan. Coba proses ulang gambar.');
    }
  }
  function renderActiveCase() {
    const activeCase = getActiveCase();
    if (!activeCase) { previewRenderToken += 1; elements.imageSelection.hidden = true; elements.dropZone.hidden = false; elements.analysisGuidance.hidden = true; resetClinicalReview(); setResultView('empty'); return; }
    elements.dropZone.hidden = true; elements.imageSelection.hidden = false; void renderSelectedPreview(activeCase);
    elements.selectedFilename.textContent = activeCase.image.filename;
    elements.selectedFilemeta.textContent = `${activeCase.image.mimeType.replace('image/', '').toUpperCase()} · ${formatBytes(activeCase.image.size)} · ${activeCase.image.width}×${activeCase.image.height}`;
    elements.imageCounter.textContent = `Kasus ${activeCaseIndex + 1} dari ${cases.length}`; elements.previousImage.disabled = activeCaseIndex <= 0; elements.nextImage.disabled = activeCaseIndex >= cases.length - 1;
    renderResults(activeCase.results, activeCase.duration, false, activeCase.systemResult); renderClinicalReview();
  }
  function saveActiveDocumentation() {
    const activeCase = getActiveCase();
    if (!activeCase || elements.body.dataset.analysisMode !== 'report' || elements.clinicalReview.hidden || renderingDocumentation) return;
    activeCase.documentation.caseId = elements.caseId.value.trim(); activeCase.documentation.examinedAt = elements.examinedAt.value;
    activeCase.documentation.clinicianConclusion = elements.clinicianConclusion.value.trim(); activeCase.documentation.notes = elements.caseNotes.value.trim();
    batchExaminer = elements.examiner.value.trim();
  }
  function navigateCases(offset) {
    if (cameraStream) return; const nextIndex = activeCaseIndex + offset; if (nextIndex < 0 || nextIndex >= cases.length) return; saveActiveDocumentation(); activeCaseIndex = nextIndex; renderActiveCase();
  }
  function removeActiveCase() {
    if (cameraStream || activeCaseIndex < 0) return; saveActiveDocumentation(); cases.splice(activeCaseIndex, 1); activeCaseIndex = cases.length ? Math.min(activeCaseIndex, cases.length - 1) : -1;
    sessionStorage.removeItem(STORAGE_KEY);
    if (!cases.length) { resetAnalysis(); setBatchStatus('Kasus terakhir dihapus. Batch dan seluruh state dokumentasi telah direset.'); return; }
    setBatchStatus(`${cases.length} kasus tersisa dalam batch.`); renderActiveCase();
  }

  function toLocalDateTimeValue(date = new Date()) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
  function renderClinicalReview() {
    const activeCase = getActiveCase(); if (elements.body.dataset.analysisMode !== 'report' || !activeCase) return;
    elements.reportLockedState.hidden = true; elements.clinicalReview.hidden = false; renderingDocumentation = true;
    elements.caseId.value = activeCase.documentation.caseId; elements.examinedAt.value = activeCase.documentation.examinedAt;
    elements.examiner.value = batchExaminer; elements.clinicianConclusion.value = activeCase.documentation.clinicianConclusion; elements.caseNotes.value = activeCase.documentation.notes;
    elements.reviewModelSuggestion.textContent = getPresentationSummary(activeCase.results, activeCase.systemResult).title;
    elements.documentationCounter.textContent = `Kasus ${activeCaseIndex + 1} dari ${cases.length}`;
    elements.previousDocumentation.disabled = activeCaseIndex <= 0; elements.nextDocumentation.disabled = activeCaseIndex >= cases.length - 1;
    renderingDocumentation = false; validateClinicalForm();
  }
  function resetClinicalReview() {
    renderingDocumentation = true; elements.clinicalReview.reset();
    elements.caseId.value = ''; elements.examinedAt.value = toLocalDateTimeValue(); elements.examiner.value = '';
    elements.clinicianConclusion.value = ''; elements.caseNotes.value = ''; elements.acknowledgement.checked = false;
    elements.clinicalReview.hidden = true; elements.reportLockedState.hidden = false; elements.reviewModelSuggestion.textContent = '—';
    elements.documentationCounter.textContent = 'Kasus 0 dari 0'; elements.previousDocumentation.disabled = true; elements.nextDocumentation.disabled = true;
    elements.prepareReport.disabled = true; elements.caseSaveStatus.textContent = 'Data hanya disimpan sementara di tab ini dan akan dihapus saat analisis direset.';
    if (elements.autofillDialog.open) elements.autofillDialog.close(); renderingDocumentation = false;
  }
  function validationErrors() {
    const errors = []; const examiner = batchExaminer || elements.examiner.value.trim(); const ids = new Set();
    if (!examiner) errors.push('nama pemeriksa batch belum diisi');
    cases.forEach((item, index) => {
      const documentation = item.documentation; const number = index + 1;
      if (!documentation.caseId) errors.push(`Kasus ${number}: ID belum diisi`);
      else if (ids.has(documentation.caseId)) errors.push(`Kasus ${number}: ID duplikat`); else ids.add(documentation.caseId);
      if (!documentation.examinedAt) errors.push(`Kasus ${number}: waktu pemeriksaan belum diisi`);
      if (!documentation.clinicianConclusion) errors.push(`Kasus ${number}: kesimpulan belum diisi`);
    });
    return errors;
  }
  function validateClinicalForm() {
    saveActiveDocumentation(); const errors = validationErrors(); elements.prepareReport.disabled = !(cases.length && !errors.length && elements.acknowledgement.checked);
    elements.caseSaveStatus.textContent = errors.length ? `Belum siap: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? `; dan ${errors.length - 3} lainnya` : ''}.` : `${cases.length} kasus lengkap dan siap dibuat menjadi laporan batch.`;
  }
  function buildBatchBundle() {
    return { version: 3, createdAt: batchCreatedAt, activeCaseIndex, examiner: batchExaminer,
      cases: cases.map((item) => { const summary = getPresentationSummary(item.results, item.systemResult); return {
        caseKey: item.caseKey, sequence: item.sequence,
        image: { filename: item.image.filename, mimeType: item.image.mimeType, width: item.image.width, height: item.image.height, reportPreview: item.image.reportPreview },
        inference: { schemaVersion: 'mesenterica-case-result-v3', modelName: modelMetadata?.manifest?.manifestVersion || 'MESENTERICA LiteRT v3', analysedAt: item.analysedAt,
          topClass: { id: summary.top.id, label: summary.top.label, score: summary.top.score, status: summary.detection.id, presentation: summary.title },
          probabilities: item.results.map(({ id, label, score }) => ({ id, label, score })), systemResult: item.systemResult },
        documentation: { ...item.documentation }
      }; }) };
  }
  function prepareReport(event) {
    event.preventDefault(); saveActiveDocumentation(); const errors = validationErrors();
    if (errors.length || !elements.acknowledgement.checked) { validateClinicalForm(); elements.clinicalReview.reportValidity(); return; }
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buildBatchBundle())); sessionStorage.removeItem(LEGACY_STORAGE_KEY); elements.caseSaveStatus.textContent = 'Seluruh batch berhasil disiapkan. Membuka halaman laporan…'; window.location.assign('report.html'); }
    catch (error) { elements.caseSaveStatus.textContent = 'Kasus tidak dapat disimpan sementara. Kurangi jumlah gambar atau reset analisis.'; showAlert(`Persiapan laporan gagal. ${error.message || ''}`.trim()); }
  }
  function openAutofillDialog() { if (cases.length) elements.autofillDialog.showModal(); }
  function confirmAutofill() {
    batchExaminer = elements.examiner.value.trim();
    cases.forEach((item, index) => {
      item.sequence = index + 1; item.documentation.caseId = automaticCaseId(item.analysedAt, item.sequence);
      item.documentation.clinicianConclusion = defaultConclusion(item.results, item.systemResult); item.documentation.conclusionWasEdited = false;
    });
    elements.autofillDialog.close(); renderClinicalReview(); elements.caseSaveStatus.textContent = `Auto-Fill diterapkan pada ${cases.length} kasus.`;
  }

  function openFilePicker() { elements.fileInput.click(); }
  async function startCamera() {
    if (cameraStream) return; hideAlert();
    if (!navigator.mediaDevices?.getUserMedia) { showAlert('Pratinjau kamera live tidak didukung browser ini. Kamera foto perangkat akan digunakan sebagai fallback.'); elements.cameraInput.click(); return; }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); cameraSessionToken += 1;
      elements.cameraVideo.srcObject = cameraStream; await elements.cameraVideo.play(); elements.dropZone.hidden = true; elements.imageSelection.hidden = true;
      elements.cameraWorkspace.hidden = false; elements.chooseCamera.disabled = true; elements.cameraCaptureCount.textContent = cases.length ? `${cases.length} kasus sudah tersimpan` : 'Belum ada frame disimpan';
      renderCapturedGallery();
      setResultView('loading'); await (model || modelPromise); startLivePrediction(cameraSessionToken);
    } catch (error) {
      stopCamera(); const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      showAlert(denied ? 'Akses kamera ditolak. Izinkan kamera pada pengaturan browser atau pilih gambar dari perangkat.' : 'Kamera tidak dapat dibuka. Pastikan tidak sedang digunakan aplikasi lain, lalu coba kembali.');
    }
  }
  function startLivePrediction(sessionToken) {
    cancelAnimationFrame(cameraLoopId); lastLivePredictionAt = 0;
    const tick = async (timestamp) => {
      if (!cameraStream || sessionToken !== cameraSessionToken) return; cameraLoopId = requestAnimationFrame(tick);
      if (livePredictionPaused || livePredictionInFlight || timestamp - lastLivePredictionAt < LIVE_INTERVAL_MS || elements.cameraVideo.readyState < 2) return;
      livePredictionInFlight = true; lastLivePredictionAt = timestamp;
      try { const prediction = await predictSource(elements.cameraVideo); if (!cameraStream || sessionToken !== cameraSessionToken || livePredictionPaused) return; lastLiveResults = prediction.results; lastLiveSystemResult = prediction.systemResult; renderResults(prediction.results, null, true, prediction.systemResult); }
      catch (error) { showAlert(`Prediksi kamera live terhenti. ${error.message || 'Tutup kamera lalu coba kembali.'}`); livePredictionPaused = true; }
      finally { livePredictionInFlight = false; }
    };
    cameraLoopId = requestAnimationFrame(tick);
  }
  function stopCamera(restoreView = true) {
    cameraSessionToken += 1; cancelAnimationFrame(cameraLoopId); cameraLoopId = 0; livePredictionPaused = false; livePredictionInFlight = false; lastLiveResults = null;
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop()); cameraStream = null; elements.cameraVideo.srcObject = null; elements.cameraWorkspace.hidden = true; elements.chooseCamera.disabled = false;
    if (restoreView) renderActiveCase();
  }
  function canvasToBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Frame kamera tidak dapat disimpan.')), 'image/jpeg', 0.92)); }
  function timestampFilename() { return `kamera-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}.jpg`; }
  async function captureCameraFrame() {
    if (!cameraStream || processingFiles || elements.cameraVideo.readyState < 2) return; livePredictionPaused = true; elements.captureImage.disabled = true;
    const canvas = document.createElement('canvas'); canvas.width = elements.cameraVideo.videoWidth; canvas.height = elements.cameraVideo.videoHeight; canvas.getContext('2d').drawImage(elements.cameraVideo, 0, 0, canvas.width, canvas.height);
    try { const blob = await canvasToBlob(canvas); await handleFiles([new File([blob], timestampFilename(), { type: 'image/jpeg' })], 'camera'); }
    finally { elements.captureImage.disabled = false; window.setTimeout(() => { if (cameraStream) livePredictionPaused = false; }, 600); }
  }
  function resetAnalysis() {
    window.clearTimeout(thresholdRerunTimer); thresholdRerunToken += 1; thresholdReprocessing = false;
    stopCamera(false); cases = []; activeCaseIndex = -1; caseSequence = 0; batchCreatedAt = new Date().toISOString(); batchExaminer = ''; elements.fileInput.value = ''; elements.cameraInput.value = '';
    lastLiveResults = null; lastLiveSystemResult = null; livePredictionPaused = false;
    previewRenderToken += 1; elements.selectedImage.width = 1; elements.selectedImage.height = 1; elements.selectedFilename.textContent = ''; elements.selectedFilemeta.textContent = ''; elements.imageSelection.hidden = true; elements.dropZone.hidden = false;
    elements.continueReport.disabled = true; elements.probabilityList.replaceChildren(); elements.analysisDuration.textContent = ''; elements.analysisGuidance.hidden = true; sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(LEGACY_STORAGE_KEY); sessionStorage.removeItem(CAPACITY_PROBE_KEY);
    renderCapturedGallery(); resetClinicalReview(); hideAlert(); setBatchStatus('Batch telah direset.'); setResultView('empty');
  }

  function bindEvents() {
    elements.chooseFile.addEventListener('click', (event) => { event.stopPropagation(); openFilePicker(); }); elements.chooseCamera.addEventListener('click', startCamera);
    elements.addImages.addEventListener('click', openFilePicker); elements.previousImage.addEventListener('click', () => navigateCases(-1)); elements.nextImage.addEventListener('click', () => navigateCases(1));
    elements.previousDocumentation.addEventListener('click', () => navigateCases(-1)); elements.nextDocumentation.addEventListener('click', () => navigateCases(1));
    elements.removeCase.addEventListener('click', removeActiveCase); elements.resetAnalysis.addEventListener('click', resetAnalysis); elements.captureImage.addEventListener('click', captureCameraFrame); elements.closeCamera.addEventListener('click', () => stopCamera(true));
    elements.autofillAll.addEventListener('click', openAutofillDialog); elements.cancelAutofill.addEventListener('click', () => elements.autofillDialog.close()); elements.confirmAutofill.addEventListener('click', confirmAutofill);
    elements.fileInput.addEventListener('change', () => handleFiles(elements.fileInput.files)); elements.cameraInput.addEventListener('change', () => handleFiles(elements.cameraInput.files, 'camera-fallback'));
    elements.threshold.addEventListener('input', () => { updateThresholdDisplay(); scheduleThresholdRerun(); });
    elements.thresholdReset.addEventListener('click', () => { elements.threshold.value = String(detectorThresholdDefault); updateThresholdDisplay(); scheduleThresholdRerun(); });
    elements.thresholdSave.addEventListener('click', saveThresholdPreference);
    elements.dropZone.addEventListener('click', (event) => { if (!event.target.closest('button')) openFilePicker(); });
    elements.dropZone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFilePicker(); } });
    ['dragenter', 'dragover'].forEach((eventName) => elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.add('is-dragging'); }));
    ['dragleave', 'drop'].forEach((eventName) => elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.remove('is-dragging'); }));
    elements.dropZone.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
    elements.clinicianConclusion.addEventListener('input', () => { if (!renderingDocumentation && getActiveCase()) getActiveCase().documentation.conclusionWasEdited = true; });
    elements.examiner.addEventListener('input', () => { if (!renderingDocumentation) batchExaminer = elements.examiner.value.trim(); });
    elements.clinicalReview.addEventListener('input', validateClinicalForm); elements.clinicalReview.addEventListener('change', validateClinicalForm); elements.clinicalReview.addEventListener('submit', prepareReport);
    elements.retry.addEventListener('click', async () => { try { await loadModel(); } catch { /* visible retry state is set in loadModel */ } });
    window.addEventListener('beforeunload', () => stopCamera(false));
  }
  async function init() {
    sessionStorage.removeItem(LEGACY_STORAGE_KEY); configureMode(); bindEvents(); resetClinicalReview(); setResultView('empty');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => { /* inference remains available online */ });
    try { await loadModel(); } catch { /* visible retry state is set in loadModel */ }
  }
  init();
})();
