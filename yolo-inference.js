(() => {
  'use strict';

  const DEFAULT_DRAW_CONFIDENCE = 0.25;
  const DEFAULT_MAX_DRAW_DIMENSION = 1400;
  const BOX_COLORS = Object.freeze({
    falciparum: '#C62828',
    vivax: '#2E7D32',
    malariae: '#EF6C00',
    ovale: '#7B1FA2',
    knowlesi: '#1565C0'
  });

  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }

  function getSourceDimensions(source) {
    const width = source.videoWidth || source.naturalWidth || source.width;
    const height = source.videoHeight || source.naturalHeight || source.height;
    if (!width || !height) throw new Error('Dimensi citra tidak valid.');
    return { width, height };
  }

  function intersectionOverUnion(a, b) {
    const left = Math.max(a.x1, b.x1); const top = Math.max(a.y1, b.y1);
    const right = Math.min(a.x2, b.x2); const bottom = Math.min(a.y2, b.y2);
    const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
    const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - intersection;
    return union > 0 ? intersection / union : 0;
  }

  function nonMaximumSuppression(candidates, iouThreshold, maxDetections) {
    const selected = [];
    for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
      if (selected.length >= maxDetections) break;
      if (!selected.some((kept) => kept.classIndex === candidate.classIndex && intersectionOverUnion(kept, candidate) > iouThreshold)) selected.push(candidate);
    }
    return selected;
  }

  function outputValue(data, shape, channel, index) {
    return shape[1] < shape[2] ? data[channel * shape[2] + index] : data[index * shape[2] + channel];
  }

  function decodeOutput(data, shape, metadata, transform) {
    if (!Array.isArray(shape) || shape.length !== 3 || shape[0] !== 1) throw new Error(`Bentuk keluaran YOLO tidak didukung: ${shape.join('×')}.`);
    const channelCount = Math.min(shape[1], shape[2]); const candidateCount = Math.max(shape[1], shape[2]);
    if (channelCount !== metadata.classNames.length + 4) throw new Error(`Model menghasilkan ${channelCount - 4} kelas, bukan ${metadata.classNames.length}.`);
    const candidates = [];
    for (let index = 0; index < candidateCount; index += 1) {
      let bestClass = -1; let bestScore = 0;
      for (let classIndex = 0; classIndex < metadata.classNames.length; classIndex += 1) {
        const score = outputValue(data, shape, classIndex + 4, index);
        if (score > bestScore) { bestScore = score; bestClass = classIndex; }
      }
      if (bestClass < 0 || bestScore < metadata.candidateThreshold) continue;
      const cx = outputValue(data, shape, 0, index); const cy = outputValue(data, shape, 1, index);
      const width = outputValue(data, shape, 2, index); const height = outputValue(data, shape, 3, index);
      const x1 = clamp((cx - width / 2 - transform.padX) / transform.scale, 0, transform.sourceWidth);
      const y1 = clamp((cy - height / 2 - transform.padY) / transform.scale, 0, transform.sourceHeight);
      const x2 = clamp((cx + width / 2 - transform.padX) / transform.scale, 0, transform.sourceWidth);
      const y2 = clamp((cy + height / 2 - transform.padY) / transform.scale, 0, transform.sourceHeight);
      if (![x1, y1, x2, y2, bestScore].every(Number.isFinite) || x2 <= x1 || y2 <= y1) continue;
      candidates.push({ classIndex: bestClass, className: metadata.classNames[bestClass], score: bestScore, x1, y1, x2, y2 });
    }
    return nonMaximumSuppression(candidates, metadata.iouThreshold, metadata.maxDetections);
  }

  function createLetterbox(source, inputWidth, inputHeight, canvas) {
    const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
    const scale = Math.min(inputWidth / sourceWidth, inputHeight / sourceHeight);
    const drawWidth = Math.round(sourceWidth * scale); const drawHeight = Math.round(sourceHeight * scale);
    const padX = Math.floor((inputWidth - drawWidth) / 2); const padY = Math.floor((inputHeight - drawHeight) / 2);
    if (canvas.width !== inputWidth) canvas.width = inputWidth;
    if (canvas.height !== inputHeight) canvas.height = inputHeight;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = 'rgb(114, 114, 114)'; context.fillRect(0, 0, inputWidth, inputHeight);
    context.drawImage(source, padX, padY, drawWidth, drawHeight);
    return { canvas, transform: { scale, padX, padY, sourceWidth, sourceHeight } };
  }

  function drawBoxes(source, detections, options = {}) {
    const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
    const requestedMaxDimension = Number(options.maxDimension);
    const maxDimension = Number.isFinite(requestedMaxDimension) && requestedMaxDimension > 0 ? requestedMaxDimension : DEFAULT_MAX_DRAW_DIMENSION;
    const requestedConfidence = Number(options.minConfidence);
    const minConfidence = Number.isFinite(requestedConfidence) ? clamp(requestedConfidence, 0, 1) : DEFAULT_DRAW_CONFIDENCE;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale)); canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / sourceWidth; const scaleY = canvas.height / sourceHeight;
    const lineWidth = clamp(canvas.width / 350, 2, 6); const fontSize = clamp(canvas.width / 55, 12, 24);
    context.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.textBaseline = 'top'; context.lineJoin = 'round';
    (Array.isArray(detections) ? detections : []).filter((detection) => detection.score >= minConfidence).forEach((detection) => {
      const x1 = clamp(detection.x1 * scaleX, 0, canvas.width); const y1 = clamp(detection.y1 * scaleY, 0, canvas.height);
      const x2 = clamp(detection.x2 * scaleX, 0, canvas.width); const y2 = clamp(detection.y2 * scaleY, 0, canvas.height);
      if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) return;
      const color = BOX_COLORS[detection.className] || '#9F151C';
      context.strokeStyle = color; context.lineWidth = lineWidth;
      const inset = lineWidth / 2;
      context.strokeRect(x1 + inset, y1 + inset, Math.max(0, x2 - x1 - lineWidth), Math.max(0, y2 - y1 - lineWidth));

      const species = detection.className ? `P. ${detection.className}` : 'Plasmodium';
      const label = `${species} ${(detection.score * 100).toFixed(1)}%`; const padding = Math.max(4, fontSize * 0.3);
      const labelWidth = Math.min(canvas.width, context.measureText(label).width + padding * 2); const labelHeight = fontSize + padding * 2;
      const labelX = clamp(x1, 0, Math.max(0, canvas.width - labelWidth)); const labelY = y1 >= labelHeight ? y1 - labelHeight : y1;
      context.fillStyle = color; context.fillRect(labelX, labelY, labelWidth, labelHeight);
      context.fillStyle = '#fff'; context.fillText(label, labelX + padding, labelY + padding, Math.max(0, labelWidth - padding * 2));
    });
    return canvas;
  }

  function resolveOutput(result) {
    if (result && typeof result.data === 'function') return result;
    if (Array.isArray(result) && result[0] && typeof result[0].data === 'function') return result[0];
    if (result && typeof result === 'object') {
      const tensor = Object.values(result).find((value) => value && typeof value.data === 'function');
      if (tensor) return tensor;
    }
    throw new Error('Tensor keluaran YOLO tidak ditemukan.');
  }

  async function load(modelUrl, metadataUrl) {
    if (!window.tf?.loadGraphModel) throw new Error('Runtime TensorFlow.js tidak tersedia.');
    const response = await fetch(metadataUrl);
    if (!response.ok) throw new Error('Metadata model tidak dapat dimuat.');
    const metadata = await response.json();
    if (metadata.task !== 'detect' || !Array.isArray(metadata.classNames) || metadata.classNames.length !== 5) throw new Error('Metadata YOLO tidak valid.');
    const graphModel = await window.tf.loadGraphModel(modelUrl);
    const shape = graphModel.inputs?.[0]?.shape;
    if (!shape || shape.length !== 4 || shape[0] !== 1 || shape[3] !== 3) { graphModel.dispose(); throw new Error('Bentuk masukan YOLO tidak didukung.'); }
    const inputHeight = shape[1]; const inputWidth = shape[2];
    const preprocessingCanvas = document.createElement('canvas');

    async function predict(source) {
      const { canvas, transform } = createLetterbox(source, inputWidth, inputHeight, preprocessingCanvas);
      const input = window.tf.tidy(() => window.tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0));
      let result;
      try {
        result = await graphModel.executeAsync(input);
        const output = resolveOutput(result); const data = await output.data();
        const detections = decodeOutput(data, output.shape, metadata, transform);
        const classScores = Object.fromEntries(metadata.classNames.map((name) => [name, 0]));
        detections.forEach((detection) => { classScores[detection.className] = Math.max(classScores[detection.className], detection.score); });
        return { detections, classScores };
      } finally {
        input.dispose();
        if (Array.isArray(result)) result.forEach((tensor) => tensor.dispose());
        else if (result && typeof result.dispose === 'function') result.dispose();
        else if (result && typeof result === 'object') Object.values(result).forEach((tensor) => tensor?.dispose?.());
      }
    }

    return { model: graphModel, metadata, inputSize: [inputWidth, inputHeight], predict, drawBoxes, dispose: () => graphModel.dispose() };
  }

  window.MesentericaYolo = { load, drawBoxes };
})();
