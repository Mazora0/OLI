import json
import os
import tempfile
from pathlib import Path

from datasets import load_dataset
from google.cloud import storage
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTTrainer, SFTConfig


def download_gcs(uri: str, local_path: str) -> None:
    if not uri.startswith("gs://"):
        raise ValueError("QLO_DATASET_URI must be a gs:// URI")
    bucket_name, blob_name = uri[5:].split("/", 1)
    storage.Client().bucket(bucket_name).blob(blob_name).download_to_filename(local_path)


def upload_dir_to_gcs(local_dir: str, output_uri: str) -> None:
    if not output_uri.startswith("gs://"):
        raise ValueError("QLO_OUTPUT_URI must be a gs:// URI")
    bucket_name, prefix = output_uri[5:].split("/", 1)
    bucket = storage.Client().bucket(bucket_name)
    for path in Path(local_dir).rglob("*"):
        if path.is_file():
            blob_name = f"{prefix.rstrip('/')}/{path.relative_to(local_dir).as_posix()}"
            bucket.blob(blob_name).upload_from_filename(str(path))


def format_messages(example):
    messages = example.get("messages") or []
    parts = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        parts.append(f"<{role}>\n{content}\n</{role}>")
    return {"text": "\n".join(parts).strip()}


def main():
    dataset_uri = os.environ["QLO_DATASET_URI"]
    output_uri = os.environ["QLO_OUTPUT_URI"]
    base_model = os.environ.get("QLO_BASE_MODEL", "Qwen/Qwen3-8B")
    max_seq_length = int(os.environ.get("QLO_MAX_SEQ_LENGTH", "2048"))
    epochs = float(os.environ.get("QLO_EPOCHS", "1"))
    batch_size = int(os.environ.get("QLO_BATCH_SIZE", "1"))
    grad_accum = int(os.environ.get("QLO_GRAD_ACCUM", "8"))
    learning_rate = float(os.environ.get("QLO_LEARNING_RATE", "2e-4"))

    with tempfile.TemporaryDirectory() as tmp:
        dataset_path = os.path.join(tmp, "qlo1-training.jsonl")
        output_dir = os.path.join(tmp, "qlo1-lora-adapter")
        download_gcs(dataset_uri, dataset_path)

        dataset = load_dataset("json", data_files=dataset_path, split="train")
        dataset = dataset.map(format_messages, remove_columns=dataset.column_names)

        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        quant_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype="float16")
        model = AutoModelForCausalLM.from_pretrained(base_model, quantization_config=quant_config, device_map="auto", trust_remote_code=True)

        peft_config = LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        )

        training_args = SFTConfig(
            output_dir=output_dir,
            dataset_text_field="text",
            max_seq_length=max_seq_length,
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=grad_accum,
            learning_rate=learning_rate,
            logging_steps=10,
            save_steps=100,
            save_total_limit=2,
            fp16=True,
            report_to=[],
        )

        trainer = SFTTrainer(
            model=model,
            train_dataset=dataset,
            tokenizer=tokenizer,
            peft_config=peft_config,
            args=training_args,
        )
        trainer.train()
        trainer.model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)

        with open(os.path.join(output_dir, "qlo1-training-manifest.json"), "w", encoding="utf-8") as f:
            json.dump({"base_model": base_model, "dataset_uri": dataset_uri, "type": "lora_adapter"}, f, ensure_ascii=False, indent=2)

        upload_dir_to_gcs(output_dir, output_uri)
        print(f"QLO 1 LoRA adapter uploaded to {output_uri}")


if __name__ == "__main__":
    main()
