(() => {
  'use strict';

  const STORAGE_KEY = 'mesenterica.currentBatch.v2';
  const LEGACY_STORAGE_KEY = 'mesenterica.currentCase.v1';
  const EXPECTED_LABELS = [
    ['normal', 'Normal'], ['vivax', 'Plasmodium vivax'], ['knowlesi', 'Plasmodium knowlesi'],
    ['ovale', 'Plasmodium ovale'], ['malariae', 'Plasmodium malariae'], ['falciparum', 'Plasmodium falciparum']
  ];
  const elements = {
    printCurrent: document.getElementById('print-current'), printAll: document.getElementById('print-all'),
    previous: document.getElementById('report-previous'), next: document.getElementById('report-next'), keyboardTip: document.getElementById('report-keyboard-tip'),
    screenCounter: document.getElementById('report-screen-counter'), stack: document.getElementById('report-stack'), paper: document.getElementById('report-paper'),
    printAllContainer: document.getElementById('print-all-container'), metaId: document.getElementById('report-meta-id'), metaCase: document.getElementById('report-meta-case'),
    metaExamined: document.getElementById('report-meta-examined'), metaTime: document.getElementById('report-meta-time'), metaExaminer: document.getElementById('report-meta-examiner'),
    formalContent: document.getElementById('formal-report-content'), resultBanner: document.getElementById('report-result-banner'), resultTitle: document.getElementById('report-result-title'),
    resultDetail: document.getElementById('report-result-detail'), detectionBadge: document.getElementById('report-detection-badge'), topScore: document.getElementById('report-top-score'),
    filenameLabel: document.getElementById('report-filename-label'), reportImage: document.getElementById('report-image'), modelName: document.getElementById('report-model-name'),
    imageSize: document.getElementById('report-image-size'), analysisTime: document.getElementById('report-analysis-time'), threshold: document.getElementById('report-threshold'),
    detectionStatus: document.getElementById('report-threshold-status'), probabilityList: document.getElementById('report-probability-list'),
    clinicianConclusion: document.getElementById('report-clinician-conclusion'), caseNotes: document.getElementById('report-case-notes'),
    guidanceTitle: document.getElementById('report-guidance-title'), guidanceSummary: document.getElementById('report-guidance-summary'), guidancePoints: document.getElementById('report-guidance-points'),
    referenceList: document.getElementById('report-reference-list'), placeholder: document.querySelector('.report-placeholder'),
    placeholderDescription: document.getElementById('report-placeholder-description'), action: document.getElementById('report-placeholder-action'), footerStatus: document.getElementById('report-footer-status')
  };

  let batch = null;
  let activeIndex = 0;

  function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
  function isValidProbability(item) { return item && isNonEmptyString(item.id) && isNonEmptyString(item.label) && Number.isFinite(item.score) && item.score >= 0 && item.score <= 1; }
  function isValidCase(item, threshold) {
    if (!item || !isNonEmptyString(item.caseKey) || !Number.isInteger(item.sequence) || item.sequence < 1) return false;
    if (!item.image || !isNonEmptyString(item.image.filename) || !isNonEmptyString(item.image.mimeType) || !isNonEmptyString(item.image.reportPreview) ||
      !item.image.reportPreview.startsWith('data:image/jpeg;base64,') || !Number.isFinite(item.image.width) || item.image.width < 1 || !Number.isFinite(item.image.height) || item.image.height < 1) return false;
    const inference = item.inference;
    if (!inference || !isNonEmptyString(inference.modelName) || !isNonEmptyString(inference.analysedAt) || !inference.topClass ||
      !isNonEmptyString(inference.topClass.id) || !isNonEmptyString(inference.topClass.label) || !isNonEmptyString(inference.topClass.status) ||
      !isNonEmptyString(inference.topClass.presentation) || !Number.isFinite(inference.topClass.score) || inference.topClass.score < 0 || inference.topClass.score > 1 ||
      !Array.isArray(inference.probabilities) || inference.probabilities.length !== 6 || !inference.probabilities.every(isValidProbability)) return false;
    const labelsMatch = EXPECTED_LABELS.every(([id, label], index) => inference.probabilities[index].id === id && inference.probabilities[index].label === label);
    const maximum = Math.max(...inference.probabilities.map((probability) => probability.score));
    const matchingTop = inference.probabilities.find((probability) => probability.id === inference.topClass.id);
    const expectedStatus = window.MesentericaClinical.getDetectionStatus(inference.topClass.score, threshold);
    if (!labelsMatch || !matchingTop || matchingTop.label !== inference.topClass.label ||
      Math.abs(matchingTop.score - inference.topClass.score) > 0.000001 || Math.abs(maximum - inference.topClass.score) > 0.000001 || inference.topClass.status !== expectedStatus.id) return false;
    const documentation = item.documentation;
    return documentation && isNonEmptyString(documentation.caseId) && isNonEmptyString(documentation.examinedAt) &&
      isNonEmptyString(documentation.clinicianConclusion) && typeof documentation.notes === 'string' && typeof documentation.conclusionWasEdited === 'boolean';
  }
  function isValidBatch(value) {
    if (!value || value.version !== 2 || !isNonEmptyString(value.createdAt) || !Number.isFinite(value.threshold) || value.threshold < 0.5 || value.threshold > 0.95 ||
      !Number.isInteger(value.activeCaseIndex) || !isNonEmptyString(value.examiner) || !Array.isArray(value.cases) || !value.cases.length ||
      value.activeCaseIndex < 0 || value.activeCaseIndex >= value.cases.length || !value.cases.every((item) => isValidCase(item, value.threshold))) return false;
    return new Set(value.cases.map((item) => item.documentation.caseId)).size === value.cases.length;
  }

  function formatDateTime(value) {
    const date = new Date(value); if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  function createReportId(item) {
    const date = new Date(item.inference.analysedAt); const pad = (value) => String(value).padStart(2, '0');
    const timestamp = Number.isNaN(date.getTime()) ? 'UNKNOWN' : `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    const caseToken = item.documentation.caseId.trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').replace(/-+/g, '-').toUpperCase() || 'KASUS';
    return `MALARIA-${timestamp}-${caseToken}`;
  }
  function renderProbabilities(item) {
    const sorted = [...item.inference.probabilities].sort((a, b) => b.score - a.score); elements.probabilityList.replaceChildren();
    sorted.forEach((probability, index) => {
      const row = document.createElement('div'); row.className = `report-probability-row${index === 0 ? ' is-top' : ''}`; const heading = document.createElement('div');
      const label = document.createElement('span'); label.textContent = probability.label; const score = document.createElement('strong'); score.textContent = `${(probability.score * 100).toFixed(1)}%`; heading.append(label, score);
      const track = document.createElement('div'); track.className = 'report-probability-track'; const bar = document.createElement('span'); bar.style.width = `${Math.max(0.5, probability.score * 100)}%`; track.append(bar); row.append(heading, track); elements.probabilityList.append(row);
    });
  }
  function renderGuidance(item, detection) {
    const guidance = window.MesentericaClinical.getGuidance(item.inference.topClass, detection); elements.guidanceTitle.textContent = guidance.title; elements.guidanceSummary.textContent = guidance.summary; elements.guidancePoints.replaceChildren();
    guidance.points.forEach((point) => { const listItem = document.createElement('li'); listItem.textContent = point; elements.guidancePoints.append(listItem); });
    elements.referenceList.replaceChildren();
    window.MesentericaClinical.getReferences(item.inference.topClass).forEach((reference) => {
      const listItem = document.createElement('li'); const link = document.createElement('a'); link.href = reference.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = reference.title; listItem.append(link); elements.referenceList.append(listItem);
    });
  }
  function renderCase(index) {
    activeIndex = index; const item = batch.cases[index]; const top = item.inference.topClass; const detection = window.MesentericaClinical.getDetectionStatus(top.score, batch.threshold);
    elements.metaId.textContent = createReportId(item); elements.metaCase.textContent = item.documentation.caseId; elements.metaExamined.textContent = formatDateTime(item.documentation.examinedAt);
    elements.metaTime.textContent = formatDateTime(item.inference.analysedAt); elements.metaExaminer.textContent = batch.examiner;
    elements.resultBanner.classList.remove('is-confident', 'is-less-confident', 'is-not-confident'); elements.resultBanner.classList.add(detection.className);
    elements.resultTitle.textContent = top.presentation; elements.resultDetail.textContent = detection.description; elements.detectionBadge.textContent = `Status Deteksi: ${detection.label}`; elements.topScore.textContent = `${(top.score * 100).toFixed(1)}%`;
    elements.filenameLabel.textContent = item.image.filename; elements.reportImage.src = item.image.reportPreview; elements.modelName.textContent = item.inference.modelName;
    elements.imageSize.textContent = `${item.image.width} × ${item.image.height} px`; elements.analysisTime.textContent = formatDateTime(item.inference.analysedAt);
    elements.threshold.textContent = `${(batch.threshold * 100).toFixed(0)}% · threshold tampilan non-tervalidasi`; elements.detectionStatus.textContent = `${detection.label} · ${detection.description}`;
    renderProbabilities(item); elements.clinicianConclusion.textContent = item.documentation.clinicianConclusion; elements.caseNotes.textContent = item.documentation.notes || 'Tidak ada catatan tambahan.'; renderGuidance(item, detection);
    elements.placeholder.hidden = true; elements.formalContent.hidden = false; elements.printCurrent.disabled = false; elements.printAll.disabled = false;
    elements.screenCounter.textContent = `Kasus ${index + 1} dari ${batch.cases.length} · ${item.documentation.caseId}`; elements.previous.disabled = index <= 0; elements.next.disabled = index >= batch.cases.length - 1;
    elements.keyboardTip.hidden = batch.cases.length <= 1; elements.stack.dataset.layers = String(Math.min(5, batch.cases.length)); elements.footerStatus.textContent = `Kasus ${index + 1} dari ${batch.cases.length} · bundel lokal`;
  }

  function stripIds(root) { root.removeAttribute('id'); root.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id')); }
  function buildPrintAll() {
    const originalIndex = activeIndex; elements.printAllContainer.replaceChildren();
    batch.cases.forEach((item, index) => { renderCase(index); const clone = elements.paper.cloneNode(true); stripIds(clone); clone.classList.add('print-report-paper'); elements.printAllContainer.append(clone); });
    renderCase(originalIndex);
  }
  function printReports(mode) {
    document.body.classList.remove('print-current', 'print-all');
    if (mode === 'all') { buildPrintAll(); document.body.classList.add('print-all'); }
    else document.body.classList.add('print-current');
    window.print();
  }
  function cleanupPrint() { document.body.classList.remove('print-current', 'print-all'); elements.printAllContainer.replaceChildren(); }
  function renderInvalidState(hasStoredValue) {
    if (hasStoredValue) { elements.placeholderDescription.textContent = 'Data batch sementara tidak lengkap atau tidak valid. Kembali ke analisis dan siapkan ulang seluruh laporan.'; elements.action.textContent = 'Siapkan ulang analisis'; }
  }
  function bindEvents() {
    elements.previous.addEventListener('click', () => { if (activeIndex > 0) renderCase(activeIndex - 1); });
    elements.next.addEventListener('click', () => { if (activeIndex < batch.cases.length - 1) renderCase(activeIndex + 1); });
    elements.printCurrent.addEventListener('click', () => printReports('current')); elements.printAll.addEventListener('click', () => printReports('all')); window.addEventListener('afterprint', cleanupPrint);
    window.addEventListener('keydown', (event) => {
      if (!batch || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === 'ArrowLeft' && activeIndex > 0) { event.preventDefault(); renderCase(activeIndex - 1); }
      if (event.key === 'ArrowRight' && activeIndex < batch.cases.length - 1) { event.preventDefault(); renderCase(activeIndex + 1); }
    });
  }
  function init() {
    let stored = null; let hasStoredValue = false;
    try { const raw = sessionStorage.getItem(STORAGE_KEY); hasStoredValue = Boolean(raw); if (raw) stored = JSON.parse(raw); }
    catch { sessionStorage.removeItem(STORAGE_KEY); }
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    if (isValidBatch(stored)) { batch = stored; activeIndex = stored.activeCaseIndex; renderCase(activeIndex); }
    else { if (hasStoredValue) sessionStorage.removeItem(STORAGE_KEY); renderInvalidState(hasStoredValue); }
    bindEvents();
  }
  init();
})();
