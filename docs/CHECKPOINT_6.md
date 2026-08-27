# Checkpoint 6 — LiteRT.js local website replacement

Completed locally on 26 August 2026. Nothing was pushed or published.

## Delivered

- Two-stage FP32 LiteRT models packaged under `model/detector/` and `model/classifier/`.
- Self-hosted LiteRT.js 2.5.0 with WebGPU-first and WASM fallback; WebNN disabled.
- Direct canvas/typed-array preprocessing, tiled detector, global NMS, crop classifier, calibration, and deterministic aggregation.
- Versioned result schema, metadata validation, checksums, and parity fixtures.
- Schema-v3 Quick/Report workflows with legacy schema-v2 report reading.
- Versioned offline service worker.
- TF.js production loader, graph-model shards, and `Normal = 1 - confidence` removed from production.

## Browser verification

- Real image WebGPU inference: 339 ms for 1061×1061; outcome correctly remained uncertain when all classifier crops were rejected.
- 25-run synthetic negative: deterministic outcomes; WebGPU median 16–25 ms and forced-WASM median 108.5 ms.
- The prior TF.js/WebGL detector measured 59.2 ms median on the same browser class/input size; LiteRT WebGPU was approximately 57–73% faster and exceeded the 20% target.
- Official Model Tester MSE: detector `1.33e-15`; classifier `6.23e-15` between WebGPU and WASM.
- Camera live inference opened and closed correctly.
- Report validation, navigation, and schema-v3 rendering passed.
- No external inference network requests.
- Full reload succeeded with the local HTTP server stopped after the first successful cache.

## Remaining limitations

- The locked challenge result remains poor and the system is not release-ready.
- Safari 17.4+ and external Chrome/Edge hardware matrices were not available in this local run.
- Forced WASM at 108.5 ms was about 83% slower than the old 59.2 ms TF.js/WebGL reference, so the no-more-than-10% WASM regression target failed.
- JS heap sampling without forced GC retained about 15 MB after 25 rapid WebGPU runs and 87 MB after WASM runs. LiteRT tensors/models are explicitly deleted, but the strict zero-growth criterion is not proven and requires developer-memory profiling before release.
- Camera capture was tested through live preview, but no camera frame was added to a clinical report during this run.

## Recovery

The prior TF.js model and tester were moved to the ignored, recoverable folder `archive/local/model-backups/tfjs-before-litert-20260826/`. The current `model/manifest.json` is the atomic switch point.
