# QLO 1 Google Cloud Training

This folder contains the starter Vertex AI training container for QLO 1 LoRA fine-tuning.

## What happens

1. Qalvero collects clean chat examples.
2. `/api/qlo-training` mirrors accepted examples to Google Cloud Storage when configured.
3. `/api/qlo-google-cloud-training` can export a full JSONL dataset to GCS.
4. If `GCLOUD_VERTEX_TRAINING_IMAGE` is configured, the same API can start a Vertex AI Custom Job.
5. The training container saves the LoRA adapter back to GCS.

## Required environment variables in Vercel

```env
GCLOUD_PROJECT_ID=
GCLOUD_TRAINING_BUCKET=
GCLOUD_VERTEX_REGION=us-central1
GCLOUD_SERVICE_ACCOUNT_JSON={...}
QLO_GCLOUD_AUTO_SYNC=on
QLO1_BASE_MODEL=Qwen/Qwen3-8B
GCLOUD_VERTEX_TRAINING_IMAGE=
GCLOUD_VERTEX_MACHINE_TYPE=n1-standard-8
GCLOUD_VERTEX_ACCELERATOR_TYPE=NVIDIA_TESLA_T4
GCLOUD_VERTEX_ACCELERATOR_COUNT=1
```

Use Secret Manager on Google Cloud for production secrets. The Vercel env var route is a practical starter setup, not the final enterprise setup.
