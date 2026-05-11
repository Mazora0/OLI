# QLO 1 Training Dataset Notes

This project now includes a QLO 1 dataset collection system.

## What it does

- Saves clean prompt/response pairs automatically unless `qv_qlo1_training_enabled` is set to `off` from the Advanced options area in Settings.
- Focuses on:
  - `ar_fusha` Modern Standard Arabic
  - `ar_eg` Egyptian Arabic
  - `en` English
  - mixed Arabic/English variants
- Exports examples as JSONL for later fine-tuning, RAG, or evaluation.
- Redacts common sensitive strings such as emails, phone numbers, bearer tokens, and API key-looking values.

## What it does not do

It does not train a real model inside Vercel. Vercel is good for hosting and API routes, not GPU training. The smart workflow is:

1. Collect clean examples.
2. Export JSONL.
3. Filter/review the dataset.
4. Train/fine-tune externally or build a RAG layer.
5. Upload/connect the trained model or retrieval index later.

## Storage

`QLO_TRAINING_MAX_STORAGE_BYTES` is set to about 8GB by default, but actual storage depends on your database provider. Supabase is the intended persistent storage here, not Vercel's temporary function filesystem.


## Auto collection behavior

- Collection defaults to ON for building the QLO 1 dataset.
- The control is placed inside Settings → Advanced options → QLO 1 Training Lab so it does not clutter the normal user settings screen.
- The user can turn collection off at any time.
- In any public production release, disclose this clearly in the Privacy Policy / Data Usage Policy. Do not collect training data from real users secretly. Yes, privacy law exists, inconveniently for people trying to build datasets in peace.

## Recommended path to a real QLO 1 model

1. Keep collecting high-quality examples from Arabic Fus'ha, Egyptian Arabic, English, and mixed chats.
2. Use likes/dislikes and edited answers to filter the dataset.
3. Export JSONL from the Advanced Training Lab.
4. Train externally with SFT/LoRA on a GPU service.
5. Deploy the resulting QLO 1 model or LoRA adapter on a proper inference endpoint.
6. Connect Qalvero AI to that endpoint using `QLO1_MODEL_ENDPOINT` and `QLO1_API_KEY`.
