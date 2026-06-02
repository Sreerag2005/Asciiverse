from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io

from app.ascii_converter import image_to_ascii, crop_face

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "ASCIIVERSE Backend Running"}


@app.post("/convert-image")
async def convert_image(
    file:       UploadFile = File(...),
    width:      int   = Form(120),
    face_mode:  bool  = Form(False),
    contrast:   float = Form(1.5),
    brightness: float = Form(1.0),
    charset:    str   = Form("complex"),
    color_mode: str   = Form("mono"),   # "mono" | "color"
):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    if face_mode:
        image = crop_face(image)

    result = image_to_ascii(
        image,
        new_width=width,
        contrast=contrast,
        brightness=brightness,
        charset=charset,
        color_mode=color_mode,
    )

    if color_mode == "color":
        # result is list[list[(char, r, g, b)]] — serialise to JSON-safe list
        serialised = [
            [[char, r, g, b] for (char, r, g, b) in row]
            for row in result
        ]
        return {"ascii_color": serialised}

    return {"ascii": result}
