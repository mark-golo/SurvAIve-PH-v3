import time
import torch
from PIL import Image
from model import Florence2Manager

# Task prompt map — Florence-2 task tokens
TASK_PROMPTS = {
    "caption":           "<CAPTION>",
    "detailed_caption":  "<DETAILED_CAPTION>",
    "object_detection":  "<OD>",
    "ocr":               "<OCR>",
}

DEFAULT_TASKS = ["caption", "detailed_caption", "object_detection"]


def _run_task(model, processor, image: Image.Image, task_prompt: str) -> dict:
    inputs = processor(text=task_prompt, images=image, return_tensors="pt")
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    with torch.no_grad():
        ids = model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=1024,
            num_beams=3,
        )
    text = processor.batch_decode(ids, skip_special_tokens=False)[0]
    return processor.post_process_generation(text, task=task_prompt, image_size=(image.width, image.height))


def run_florence2(image: Image.Image, tasks: list[str] | None = None) -> dict:
    if tasks is None:
        tasks = DEFAULT_TASKS

    mgr = Florence2Manager()
    if not mgr.loaded:
        raise RuntimeError("Model is not loaded")

    start = time.monotonic()
    results = {}
    for task_key in tasks:
        prompt = TASK_PROMPTS.get(task_key)
        if prompt is None:
            continue
        raw = _run_task(mgr.model, mgr.processor, image, prompt)
        results[task_key] = raw.get(prompt, "")

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # --- Parse caption ---
    caption = results.get("caption") or None
    if isinstance(caption, str):
        caption = caption.strip()

    # --- Parse detailed_caption ---
    detailed_caption = results.get("detailed_caption") or None
    if isinstance(detailed_caption, str):
        detailed_caption = detailed_caption.strip()

    # --- Parse object_detection ---
    objects = []
    od_raw = results.get("object_detection")
    if isinstance(od_raw, dict):
        labels = od_raw.get("labels", [])
        bboxes = od_raw.get("bboxes", [])
        for i, label in enumerate(labels):
            bbox = bboxes[i] if i < len(bboxes) else None
            objects.append({"label": str(label), "bbox": bbox})

    # --- Parse OCR ---
    ocr_text = results.get("ocr") or None
    if isinstance(ocr_text, str):
        ocr_text = ocr_text.strip() or None

    return {
        "caption":          caption,
        "detailed_caption": detailed_caption,
        "objects":          objects,
        "object_count":     len(objects),
        "ocr_text":         ocr_text,
        "processing_time_ms": elapsed_ms,
    }
