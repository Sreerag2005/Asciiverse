from PIL import Image, ImageEnhance, ImageFilter
import cv2
import numpy as np

# ── Charset presets ───────────────────────────────────────────────────────────
DENSITY_MAPS = {
    "complex":  " .'^,:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    "simple":   " .:-=+*#%@",
    "blocks":   " ░▒▓█",
    "binary":   " 01",
}

DEFAULT_CHARSET = "complex"


# ── Perceptual luminance (better than flat average) ───────────────────────────
def rgb_to_lum(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# ── Contrast formula matching Photoshop / GitHub project ─────────────────────
def apply_contrast(lum, contrast_factor):
    return contrast_factor * (lum - 128) + 128


# ── Face detection & crop ─────────────────────────────────────────────────────
def crop_face(image: Image.Image, padding_ratio: float = 0.35) -> Image.Image:
    """Detect the largest face and return a square crop with padding."""
    img_np = np.array(image.convert("RGB"))
    img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

    # Try progressively looser detection before giving up
    faces = []
    for min_n in [5, 3, 1]:
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=min_n
        )
        if len(faces) > 0:
            break

    print(f"Faces found: {len(faces)}")
    if len(faces) == 0:
        return image  # fallback — return full image

    # Pick largest face
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h = faces[0]

    cx, cy = x + w // 2, y + h // 2
    half = int(max(w, h) * (1 + padding_ratio))

    x1 = max(0, cx - half)
    y1 = max(0, cy - half)
    x2 = min(img_np.shape[1], cx + half)
    y2 = min(img_np.shape[0], cy + half)

    return Image.fromarray(img_np[y1:y2, x1:x2])


# ── Core converter ────────────────────────────────────────────────────────────
def image_to_ascii(
    image: Image.Image,
    new_width: int = 120,
    contrast: float = 1.5,       # 1.0 = neutral; higher = more punchy
    brightness: float = 1.0,     # 1.0 = neutral
    charset: str = DEFAULT_CHARSET,
    color_mode: str = "mono",    # "mono" | "color"
) -> str | list[list[tuple]]:
    """
    Convert a PIL Image to ASCII art.

    Returns:
      - color_mode="mono"  → plain string (newline-separated rows)
      - color_mode="color" → list of rows, each row a list of (char, r, g, b) tuples
    """
    char_map = DENSITY_MAPS.get(charset, DENSITY_MAPS[DEFAULT_CHARSET])

    # 1. Pre-sharpen slightly for crisper edges
    image = image.filter(ImageFilter.UnsharpMask(radius=1, percent=80, threshold=3))

    # 2. Resize — correct aspect ratio compensation for monospace fonts
    #    Monospace chars are roughly 0.55× as wide as they are tall.
    width, height = image.size
    aspect = height / width
    new_height = int(new_width * aspect * 0.45)  # 0.45 = tighter, slightly more detail
    resized = image.resize((new_width, new_height), Image.LANCZOS)

    # 3. Brightness adjustment
    if brightness != 1.0:
        resized = ImageEnhance.Brightness(resized).enhance(brightness)

    # 4. Contrast adjustment (using standard formula)
    contrast_factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))

    if color_mode == "color":
        rgb_img = resized.convert("RGB")
        pixels = list(rgb_img.getdata())
        rows = []
        for row_i in range(new_height):
            row = []
            for col_i in range(new_width):
                r, g, b = pixels[row_i * new_width + col_i]
                lum = rgb_to_lum(r, g, b)
                lum = apply_contrast(lum, contrast_factor)
                lum = max(0, min(255, lum))
                idx = int(lum / 255 * (len(char_map) - 1))
                row.append((char_map[idx], r, g, b))
            rows.append(row)
        return rows

    # Mono path — convert to grayscale
    gray_img = resized.convert("L")
    pixels = list(gray_img.getdata())

    lines = []
    for row_i in range(new_height):
        line = ""
        for col_i in range(new_width):
            lum = pixels[row_i * new_width + col_i]
            lum = apply_contrast(lum, contrast_factor)
            lum = max(0, min(255, lum))
            idx = int(lum / 255 * (len(char_map) - 1))
            line += char_map[idx]
        lines.append(line)

    return "\n".join(lines)
