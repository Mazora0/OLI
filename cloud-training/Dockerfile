FROM pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY train_qlo1_lora.py ./train_qlo1_lora.py

CMD ["python", "train_qlo1_lora.py"]
