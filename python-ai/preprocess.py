import io
from PIL import Image
from config import settings

# Magic bytes for accepted image formats
_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG":      "image/png",
    b"RIFF":         None,  # WEBP — verified by checking bytes 8-12
}


def _detect_mime(data: bytes) -> str | None:
    for sig, mime in _MAGIC.items():
        if data[:len(sig)] == sig:
            if sig == b"RIFF" and data[8:12] == b"WEBP":
                return "image/webp"
            if sig != b"RIFF":
                return mime
    return None


def validate_and_load(data: bytes) -> Image.Image:
    if len(data) > settings.max_image_bytes:
        raise ValueError(f"Image exceeds {settings.max_image_bytes // (1024*1024)} MB limit")

    mime = _detect_mime(data)
    if mime is None:
        raise ValueError("Unsupported image format; only JPEG, PNG, and WEBP are accepted")

    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Could not decode image: {exc}") from exc

    # Resize so the longest edge is at most max_image_px
    w, h = img.size
    limit = settings.max_image_px
    if w > limit or h > limit:
        if w >= h:
            img = img.resize((limit, int(h * limit / w)), Image.LANCZOS)
        else:
            img = img.resize((int(w * limit / h), limit), Image.LANCZOS)

    return img
