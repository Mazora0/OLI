# QLO 1 Google Cloud Training Setup

This project now supports automatic QLO 1 dataset backup to Google Cloud Storage and optional Vertex AI training.

## What is automatic now

- Accepted QLO 1 training examples are saved in Supabase.
- If Google Cloud env vars are configured, accepted examples are mirrored automatically to Cloud Storage as small JSON records.
- From Settings → Advanced options → QLO 1 Training Lab, you can:
  - check Google Cloud status,
  - sync the full JSONL dataset to Cloud Storage,
  - start a Vertex AI Custom Job if a training container image is configured.

## Required Vercel environment variables

```env
GCLOUD_PROJECT_ID=
GCLOUD_TRAINING_BUCKET=
GCLOUD_VERTEX_REGION=us-central1
GCLOUD_SERVICE_ACCOUNT_JSON={...}
QLO_GCLOUD_AUTO_SYNC=on
QLO1_BASE_MODEL=Qwen/Qwen3-8B
```

For training start from the app, also add:

```env
GCLOUD_VERTEX_TRAINING_IMAGE=
GCLOUD_VERTEX_MACHINE_TYPE=n1-standard-8
GCLOUD_VERTEX_ACCELERATOR_TYPE=NVIDIA_TESLA_T4
GCLOUD_VERTEX_ACCELERATOR_COUNT=1
```

## Safer secret handling

For production, use Google Secret Manager and a service account with minimum required permissions. Avoid giving broad Owner permissions to a service account because that is how tiny projects grow tiny disasters.

## Minimum IAM roles for the service account

- Storage Object Admin on the training bucket.
- Vertex AI User or a narrower custom role for Custom Jobs.
- Artifact Registry Reader for the training image, if the image is private.

## Training container

The starter container is in:

```text
cloud-training/
```

It trains a LoRA adapter and uploads the output back to Google Cloud Storage.
