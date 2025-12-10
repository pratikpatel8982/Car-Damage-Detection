import cv2
import numpy as np
import tempfile
import os
from model_loader import run_inference, load_model
import io
from PIL import Image

model = load_model()

def process_video(video_bytes):
    # Create temp input .mp4
    input_temp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    input_temp.write(video_bytes)
    input_temp.close()

    cap = cv2.VideoCapture(input_temp.name)

    if not cap.isOpened():
        print("ERROR: failed to read video")
        return None

    # Read video info
    fps = cap.get(cv2.CAP_PROP_FPS)
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Output mp4 (REAL playable mp4)
    output_path = os.path.join(
        tempfile.gettempdir(),
        f"processed_{next(tempfile._get_candidate_names())}.mp4"
    )

    # IMPORTANT: Use H.264 encoding (Chrome loves it)
    fourcc = cv2.VideoWriter_fourcc(*"avc1")  # H.264

    writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    if not writer.isOpened():
        print("ERROR: VideoWriter failed to open")
        return None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Convert frame to PIL
        pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        # Run YOLO on each frame
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG")
        annotated_img, detections = run_inference(model, buf.getvalue())

        annotated_cv = cv2.cvtColor(np.array(annotated_img), cv2.COLOR_RGB2BGR)

        writer.write(annotated_cv)

    cap.release()
    writer.release()

    return output_path
