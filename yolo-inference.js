import { Tensor, isWebGPUSupported, loadAndCompile, loadLiteRt, supportsFeature } from './vendor/litert/litert-core.js';

const SPECIES = Object.freeze(['falciparum', 'vivax', 'malariae', 'ovale', 'knowlesi']);
const NON_PARASITE = 'non_parasite';
const BOX_COLORS = Object.freeze({ falciparum: '#C62828', vivax: '#2E7D32', malariae: '#EF6C00', ovale: '#7B1FA2', knowlesi: '#1565C0', non_parasite: '#795548', uncertain: '#E17600' });

function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function sourceDimensions(source) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) throw new Error('Dimensi citra tidak valid.');
  return { width, height };
}
function sameShape(actual, expected) { return actual.length === expected.length && expected.every((value, index) => Number(actual[index]) === value); }
function iou(a, b) {
  const intersection = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - intersection;
  return union > 0 ? intersection / union : 0;
}
function nms(candidates, threshold, maximum = Infinity) {
  const selected = [];
  for (const candidate of [...candidates].sort((a, b) => b.detectorConfidence - a.detectorConfidence)) {
    if (selected.length >= maximum) break;
    if (!selected.some((kept) => iou(kept, candidate) > threshold)) selected.push(candidate);
  }
  return selected;
}
function tilePositions(length, size, overlap) {
  if (length <= size) return [0];
  const stride = Math.round(size * (1 - overlap)); const values = [];
  for (let value = 0; value <= length - size; value += stride) values.push(value);
  const last = length - size; if (values.at(-1) !== last) values.push(last); return values;
}
function reflect101(index, length) {
  if (length <= 1) return 0;
  let value = index;
  while (value < 0 || value >= length) value = value < 0 ? -value : 2 * length - value - 2;
  return value;
}
function imageDataToNchw(imageData) {
  const pixels = imageData.data; const plane = imageData.width * imageData.height; const output = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    output[index] = pixels[index * 4] / 255; output[plane + index] = pixels[index * 4 + 1] / 255; output[plane * 2 + index] = pixels[index * 4 + 2] / 255;
  }
  return output;
}
function makeSourceCanvas(source) {
  const { width, height } = sourceDimensions(source); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d', { alpha: false, willReadFrequently: true }).drawImage(source, 0, 0, width, height); return canvas;
}
function extractReflectedPixels(sourceData, sourceWidth, sourceHeight, left, top, width, height) {
  const output = new ImageData(width, height); const target = output.data;
  for (let y = 0; y < height; y += 1) {
    const sourceY = reflect101(top + y, sourceHeight);
    for (let x = 0; x < width; x += 1) {
      const sourceX = reflect101(left + x, sourceWidth); const from = (sourceY * sourceWidth + sourceX) * 4; const to = (y * width + x) * 4;
      target[to] = sourceData[from]; target[to + 1] = sourceData[from + 1]; target[to + 2] = sourceData[from + 2]; target[to + 3] = 255;
    }
  }
  return output;
}
async function runModel(model, values, shape) {
  const input = new Tensor(values, shape); let outputs;
  try { outputs = await model.run(input); return new Float32Array(await outputs[0].data()); }
  finally { input.delete(); if (Array.isArray(outputs)) outputs.forEach((tensor) => tensor.delete()); }
}
function decodeDetector(data, metadata, left, top, sourceWidth, sourceHeight, candidateThreshold = metadata.candidateThreshold) {
  const count = metadata.output.shape[2]; const size = metadata.tileSize; const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const confidence = data[4 * count + index]; if (confidence < candidateThreshold) continue;
    const cx = data[index] * size; const cy = data[count + index] * size; const width = data[2 * count + index] * size; const height = data[3 * count + index] * size;
    const x1 = clamp(cx - width / 2, 0, size); const y1 = clamp(cy - height / 2, 0, size); const x2 = clamp(cx + width / 2, 0, size); const y2 = clamp(cy + height / 2, 0, size);
    if (![x1, y1, x2, y2, confidence].every(Number.isFinite) || x2 <= x1 || y2 <= y1) continue;
    candidates.push({ x1: clamp(x1 + left, 0, sourceWidth), y1: clamp(y1 + top, 0, sourceHeight), x2: clamp(x2 + left, 0, sourceWidth), y2: clamp(y2 + top, 0, sourceHeight), detectorConfidence: confidence });
  }
  return nms(candidates, metadata.tileNmsIou, metadata.maxDetectionsPerTile);
}
function calibratedProbabilities(values, temperature) {
  const powered = Array.from(values, (value) => Math.pow(Math.max(Number(value), 1e-12), 1 / temperature)); const total = powered.reduce((sum, value) => sum + value, 0);
  return powered.map((value) => value / total);
}
function cropQuality(imageData) {
  const { data, width, height } = imageData; const count = width * height; const gray = new Float32Array(count); let sum = 0; let clipped = 0;
  for (let index = 0; index < count; index += 1) { const value = 0.299 * data[index * 4] + 0.587 * data[index * 4 + 1] + 0.114 * data[index * 4 + 2]; gray[index] = value; sum += value; if (value < 5 || value > 250) clipped += 1; }
  const mean = sum / count; let variance = 0; for (const value of gray) variance += (value - mean) ** 2;
  const contrast = Math.min(1, Math.sqrt(variance / count) / 10); const exposure = clamp((0.9 - clipped / count) / 0.4, 0, 1);
  let lapSum = 0; let lapSq = 0; let lapCount = 0;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) { const index = y * width + x; const value = gray[index - width] + gray[index + width] + gray[index - 1] + gray[index + 1] - 4 * gray[index]; lapSum += value; lapSq += value * value; lapCount += 1; }
  const lapMean = lapSum / Math.max(lapCount, 1); const focus = Math.min(1, Math.max(0, lapSq / Math.max(lapCount, 1) - lapMean * lapMean));
  return Math.round(contrast * exposure * focus * 1e6) / 1e6;
}
function extractClassifierCrop(sourceData, sourceWidth, sourceHeight, box, metadata, workCanvas) {
  const sideFloat = Math.max(Math.max(box.x2 - box.x1, box.y2 - box.y1) * (1 + metadata.cropContextRatio), Math.min(sourceWidth, sourceHeight) * metadata.minimumHostCellSideRatio);
  const side = Math.max(1, Math.round(sideFloat)); const left = Math.round((box.x1 + box.x2) / 2 - sideFloat / 2); const top = Math.round((box.y1 + box.y2) / 2 - sideFloat / 2);
  const sourceCrop = document.createElement('canvas'); sourceCrop.width = side; sourceCrop.height = side;
  sourceCrop.getContext('2d', { alpha: false }).putImageData(extractReflectedPixels(sourceData, sourceWidth, sourceHeight, left, top, side, side), 0, 0);
  workCanvas.width = metadata.cropSize; workCanvas.height = metadata.cropSize; const context = workCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(sourceCrop, 0, 0, side, side, 0, 0, metadata.cropSize, metadata.cropSize);
  return context.getImageData(0, 0, metadata.cropSize, metadata.cropSize);
}
function emptySpeciesEvidence() { return Object.fromEntries(SPECIES.map((name) => [name, 0])); }
function normalizedEvidence(scores) {
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(SPECIES.map((name) => [name, total ? scores[name] / total : 0]));
}
export function aggregate(detectorBoxes, classifierOutputs, thresholds) {
  if (!detectorBoxes.length) return { outcomeCode: 'no_parasite_detected', message: 'Tidak ada kandidat parasit terdeteksi pada gambar ini', reason: 'detector tidak menghasilkan bounding box', primarySpecies: null, secondarySpecies: [], acceptedSpeciesCells: 0, candidateSpeciesCells: 0, rejectedCells: 0, speciesCounts: {}, candidateSpeciesCounts: {}, speciesEvidence: emptySpeciesEvidence(), candidateSpeciesEvidence: emptySpeciesEvidence(), displaySpeciesEvidence: emptySpeciesEvidence(), evidenceMode: 'none', cells: [] };
  const cells = detectorBoxes.map((box, index) => {
    const output = classifierOutputs[index]; const predictedClass = output.predictedClass; let rejectionReason = null;
    if (predictedClass === NON_PARASITE) rejectionReason = 'classified_non_parasite'; else if (!SPECIES.includes(predictedClass)) rejectionReason = 'unknown_classifier_class'; else if (output.probabilities[predictedClass] < (thresholds[predictedClass] ?? 1)) rejectionReason = 'below_species_acceptance_threshold'; else if (output.qualityWeight <= 0) rejectionReason = 'unusable_crop_quality';
    return { ...box, ...output, acceptedSpecies: rejectionReason === null, rejectionReason };
  });
  const accepted = cells.filter((cell) => cell.acceptedSpecies); const counts = {}; const scores = emptySpeciesEvidence();
  for (const cell of accepted) { counts[cell.predictedClass] = (counts[cell.predictedClass] || 0) + 1; const weight = cell.detectorConfidence * cell.qualityWeight; for (const species of SPECIES) scores[species] += weight * (cell.probabilities[species] || 0); }
  const evidence = normalizedEvidence(scores);
  const candidateCells = cells.filter((cell) => !cell.acceptedSpecies && cell.rejectionReason === 'below_species_acceptance_threshold' && SPECIES.includes(cell.predictedClass) && cell.qualityWeight > 0);
  const candidateCounts = {}; const candidateScores = emptySpeciesEvidence();
  for (const cell of candidateCells) { candidateCounts[cell.predictedClass] = (candidateCounts[cell.predictedClass] || 0) + 1; const weight = cell.detectorConfidence * cell.qualityWeight; for (const species of SPECIES) candidateScores[species] += weight * (cell.probabilities[species] || 0); }
  const candidateEvidence = normalizedEvidence(candidateScores); const candidateQualifying = Object.keys(candidateCounts).filter((name) => candidateCounts[name] >= 2).sort((a, b) => candidateScores[b] - candidateScores[a]);
  const dominant = [...SPECIES].sort((a, b) => scores[b] - scores[a])[0]; const base = { cells, acceptedSpeciesCells: accepted.length, candidateSpeciesCells: candidateCells.length, rejectedCells: cells.length - accepted.length, speciesCounts: counts, candidateSpeciesCounts: candidateCounts, speciesEvidence: evidence, candidateSpeciesEvidence: candidateEvidence, displaySpeciesEvidence: accepted.length ? evidence : candidateEvidence, evidenceMode: accepted.length ? 'accepted' : (candidateCells.length ? 'provisional' : 'none') };
  if (!accepted.length && candidateQualifying.length) { const species = candidateQualifying[0]; return { ...base, outcomeCode: 'species_uncertain', message: `Indikasi mengarah ke Plasmodium ${species}—belum tervalidasi`, reason: `terdapat ${candidateCounts[species]} kandidat ${species} yang concordant, tetapi seluruhnya belum memenuhi threshold penerimaan spesies`, primarySpecies: species, secondarySpecies: candidateQualifying.slice(1) }; }
  if (!accepted.length) return { ...base, outcomeCode: 'species_uncertain', message: 'Kandidat terdeteksi—tinjauan manual diperlukan', reason: candidateCells.length ? 'classifier menghasilkan indikasi spesies, tetapi belum ada kandidat yang memenuhi threshold penerimaan' : 'seluruh kandidat diklasifikasikan sebagai non-parasite atau memiliki crop yang tidak dapat digunakan', primarySpecies: null, secondarySpecies: [] };
  if (accepted.length === 1) return { ...base, outcomeCode: 'species_uncertain', message: 'Parasite detected; species uncertain', reason: 'exactly one accepted infected cell is insufficient for species reporting', primarySpecies: accepted[0].predictedClass, secondarySpecies: [] };
  const qualifying = Object.keys(counts).filter((name) => counts[name] >= 2).sort((a, b) => scores[b] - scores[a]);
  if (qualifying.length >= 2) return { ...base, outcomeCode: 'suspected_mixed', message: `Suspected mixed infection: ${qualifying.map((name) => `P. ${name}`).join(' + ')}`, reason: 'at least two distinct accepted cells support each reported species', primarySpecies: qualifying[0], secondarySpecies: qualifying.slice(1) };
  if (qualifying.length === 1) { const species = qualifying[0]; const conflicts = Object.keys(counts).filter((name) => name !== species).sort(); return { ...base, outcomeCode: 'suspected_species', message: conflicts.length ? `Suspected Plasmodium ${species} infection; conflicting evidence requires review` : `Suspected Plasmodium ${species} infection`, reason: conflicts.length ? 'at least two cells support the dominant species but weaker conflicting cells are present' : 'at least two concordant accepted cells support one species', primarySpecies: species, secondarySpecies: conflicts }; }
  return { ...base, outcomeCode: 'species_uncertain', message: 'Parasite detected; conflicting species evidence requires manual review', reason: 'multiple accepted cells are present but no species has two concordant cells', primarySpecies: dominant, secondarySpecies: [] };
}
async function sha256(bytes) { const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''); }
async function fetchJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Gagal memuat ${url}.`); return response.json(); }
async function fetchVerifiedModel(url, expectedHash) { const response = await fetch(url); if (!response.ok) throw new Error(`Gagal memuat model ${url}.`); const bytes = await response.arrayBuffer(); if (await sha256(bytes) !== expectedHash) throw new Error(`Checksum model tidak cocok: ${url}.`); return new Uint8Array(bytes); }
function validateModel(model, inputShape, outputShape, label) {
  const inputs = model.getInputDetails(); const outputs = model.getOutputDetails();
  if (inputs.length !== 1 || outputs.length !== 1 || inputs[0].dtype !== 'float32' || outputs[0].dtype !== 'float32' || !sameShape(inputs[0].shape, inputShape) || !sameShape(outputs[0].shape, outputShape)) throw new Error(`${label} memiliki dtype, bentuk, atau layout tensor yang tidak kompatibel.`);
}

export async function loadTwoStage(manifestUrl = new URL('model/manifest.json', document.baseURI).href, options = {}) {
  const loadStarted = performance.now(); const manifest = await fetchJson(manifestUrl);
  if (manifest.schemaVersion !== 'mesenterica-litert-manifest-v3' || manifest.runtime?.webnnEnabled !== false) throw new Error('Manifest LiteRT tidak kompatibel.');
  const base = new URL('.', manifestUrl); const detectorMetadata = await fetchJson(new URL(manifest.detector.metadata, base)); const classifierMetadata = await fetchJson(new URL(manifest.classifier.metadata, base));
  if (detectorMetadata.classNames?.length !== 1 || detectorMetadata.classNames[0] !== 'infected_cell') throw new Error('Detector lama lima-kelas ditolak.');
  if (classifierMetadata.classNames?.length !== 6 || !classifierMetadata.classNames.includes(NON_PARASITE)) throw new Error('Classifier harus memiliki enam kelas termasuk non_parasite.');
  const [detectorBytes, classifierBytes] = await Promise.all([fetchVerifiedModel(new URL(manifest.detector.model, base), manifest.detector.sha256), fetchVerifiedModel(new URL(manifest.classifier.model, base), manifest.classifier.sha256)]);
  const jspi = await supportsFeature('jspi').catch(() => false); await loadLiteRt(new URL('vendor/litert/wasm/', document.baseURI).href, { jspi });
  let accelerator = options.forceAccelerator === 'wasm' ? 'wasm' : (isWebGPUSupported() ? 'webgpu' : 'wasm'); let fallbackReason = accelerator === 'wasm' ? (options.forceAccelerator === 'wasm' ? 'WASM forced by verification fixture' : 'WebGPU is unavailable') : null; let detectorModel; let classifierModel;
  async function compile(selected) { const options = selected === 'webgpu' ? { accelerator: 'webgpu', gpuOptions: { precision: 'fp32' } } : { accelerator: 'wasm' }; const detector = await loadAndCompile(detectorBytes, options); try { return [detector, await loadAndCompile(classifierBytes, options)]; } catch (error) { detector.delete(); throw error; } }
  try { [detectorModel, classifierModel] = await compile(accelerator); } catch (error) { if (accelerator === 'wasm') throw error; fallbackReason = `WebGPU compilation failed: ${error.message || error}`; accelerator = 'wasm'; [detectorModel, classifierModel] = await compile('wasm'); }
  validateModel(detectorModel, detectorMetadata.input.shape, detectorMetadata.output.shape, 'Detector'); validateModel(classifierModel, classifierMetadata.input.shape, classifierMetadata.output.shape, 'Classifier');
  const mixedExecution = accelerator === 'webgpu' && (!detectorModel.isFullyAccelerated || !classifierModel.isFullyAccelerated); if (mixedExecution) fallbackReason = 'Some operators execute with the LiteRT WASM fallback';
  const tileCanvas = document.createElement('canvas'); tileCanvas.width = detectorMetadata.tileSize; tileCanvas.height = detectorMetadata.tileSize; const cropCanvas = document.createElement('canvas');

  async function predict(source, options = {}) {
    const requestedThreshold = Number(options.candidateThreshold); const candidateThreshold = Number.isFinite(requestedThreshold) ? clamp(requestedThreshold, 0.01, 0.99) : detectorMetadata.candidateThreshold;
    const totalStarted = performance.now(); const sourceCanvas = makeSourceCanvas(source); const { width, height } = sourceDimensions(source); const sourceContext = sourceCanvas.getContext('2d', { alpha: false, willReadFrequently: true }); const sourcePixels = sourceContext.getImageData(0, 0, width, height).data;
    const tileContext = tileCanvas.getContext('2d', { alpha: false, willReadFrequently: true }); const detectorBoxes = []; const detectorStarted = performance.now(); let tileCount = 0;
    for (const top of tilePositions(height, detectorMetadata.tileSize, detectorMetadata.tileOverlap)) for (const left of tilePositions(width, detectorMetadata.tileSize, detectorMetadata.tileOverlap)) {
      tileCount += 1; tileContext.putImageData(extractReflectedPixels(sourcePixels, width, height, left, top, detectorMetadata.tileSize, detectorMetadata.tileSize), 0, 0);
      const output = await runModel(detectorModel, imageDataToNchw(tileContext.getImageData(0, 0, detectorMetadata.tileSize, detectorMetadata.tileSize)), detectorMetadata.input.shape); detectorBoxes.push(...decodeDetector(output, detectorMetadata, left, top, width, height, candidateThreshold));
    }
    const deduplicated = nms(detectorBoxes, detectorMetadata.globalNms.iouThreshold); const detectorMilliseconds = performance.now() - detectorStarted; const classifierStarted = performance.now(); const classifierOutputs = [];
    for (const box of deduplicated) { const crop = extractClassifierCrop(sourcePixels, width, height, box, classifierMetadata, cropCanvas); const output = await runModel(classifierModel, imageDataToNchw(crop), classifierMetadata.input.shape); const probabilitiesArray = calibratedProbabilities(output, classifierMetadata.temperature); const probabilities = Object.fromEntries(classifierMetadata.classNames.map((name, index) => [name, probabilitiesArray[index]])); const predictedClass = classifierMetadata.classNames[probabilitiesArray.indexOf(Math.max(...probabilitiesArray))]; classifierOutputs.push({ predictedClass, probabilities, qualityWeight: cropQuality(crop) }); }
    const aggregation = aggregate(deduplicated, classifierOutputs, classifierMetadata.acceptanceThresholds);
    return { schemaVersion: 'mesenterica-case-result-v3', runtime: { name: 'LiteRT.js', version: manifest.runtime.version, accelerator, mixedExecution, fallbackReason }, timing: { detectorMilliseconds, classifierMilliseconds: performance.now() - classifierStarted, totalMilliseconds: performance.now() - totalStarted, tileCount }, detectorBoxes: deduplicated, cells: aggregation.cells, speciesEvidence: aggregation.speciesEvidence, candidateSpeciesEvidence: aggregation.candidateSpeciesEvidence, displaySpeciesEvidence: aggregation.displaySpeciesEvidence, evidenceMode: aggregation.evidenceMode, outcome: { code: aggregation.outcomeCode, message: aggregation.message, reason: aggregation.reason, primarySpecies: aggregation.primarySpecies, secondarySpecies: aggregation.secondarySpecies }, counts: { detectorBoxes: deduplicated.length, acceptedSpeciesCells: aggregation.acceptedSpeciesCells, candidateSpeciesCells: aggregation.candidateSpeciesCells, rejectedCells: aggregation.rejectedCells, species: aggregation.speciesCounts, candidateSpecies: aggregation.candidateSpeciesCounts }, thresholds: { detectorCandidate: candidateThreshold, detectorDefault: detectorMetadata.candidateThreshold, classifierAcceptance: { ...classifierMetadata.acceptanceThresholds } }, versions: { manifest: manifest.manifestVersion, detector: detectorMetadata.modelVersion, classifier: classifierMetadata.modelVersion, aggregation: manifest.aggregationVersion, preprocessing: 'nchw-rgb-reflect101-v1', thresholds: candidateThreshold === detectorMetadata.candidateThreshold ? 'group-safe-provisional-v1' : 'user-adjusted-detector-v1' } };
  }
  function drawBoxes(source, result, options = {}) {
    const { width, height } = sourceDimensions(source); const scale = Math.min(1, (options.maxDimension || 1400) / Math.max(width, height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale)); const context = canvas.getContext('2d', { alpha: false }); context.drawImage(source, 0, 0, canvas.width, canvas.height);
    context.font = `700 ${clamp(canvas.width / 55, 12, 24)}px system-ui`; context.textBaseline = 'top'; context.lineJoin = 'round';
    for (const cell of result?.cells || []) { const isNonParasite = cell.predictedClass === NON_PARASITE; const className = cell.acceptedSpecies || (!isNonParasite && SPECIES.includes(cell.predictedClass)) ? cell.predictedClass : (isNonParasite ? NON_PARASITE : 'uncertain'); const color = BOX_COLORS[className] || BOX_COLORS.uncertain; const x1 = cell.x1 * scale; const y1 = cell.y1 * scale; const x2 = cell.x2 * scale; const y2 = cell.y2 * scale; context.strokeStyle = color; context.lineWidth = clamp(canvas.width / 350, 2, 6); context.setLineDash(cell.acceptedSpecies ? [] : [context.lineWidth * 2, context.lineWidth]); context.strokeRect(x1, y1, x2 - x1, y2 - y1); context.setLineDash([]); const probability = cell.probabilities?.[cell.predictedClass] || 0; const label = cell.acceptedSpecies ? `infected cell · P. ${cell.predictedClass} ${(probability * 100).toFixed(1)}%` : (isNonParasite ? `ditolak · non-parasite ${(probability * 100).toFixed(1)}%` : `indikasi · P. ${cell.predictedClass || 'review'} ${(probability * 100).toFixed(1)}% · belum diterima`); const padding = 5; const labelWidth = context.measureText(label).width + padding * 2; const fontSize = Number(context.font.match(/([0-9.]+)px/)?.[1] || 14); const labelHeight = fontSize + padding * 2; const labelY = y1 >= labelHeight ? y1 - labelHeight : y1; context.fillStyle = color; context.fillRect(x1, labelY, labelWidth, labelHeight); context.fillStyle = '#fff'; context.fillText(label, x1 + padding, labelY + padding); }
    return canvas;
  }
  return { metadata: { manifest, detector: detectorMetadata, classifier: classifierMetadata }, runtime: { accelerator, mixedExecution, fallbackReason, loadMilliseconds: performance.now() - loadStarted }, predict, drawBoxes, dispose() { detectorModel.delete(); classifierModel.delete(); } };
}
