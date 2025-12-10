from ultralytics import YOLO
from PIL import Image
import numpy as np
from io import BytesIO
import os

def load_model():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "model", "model.pt")
    print("Loading YOLOv12 model from:", model_path)

    model = YOLO(model_path)
    print("Model loaded!")
    return model



def run_inference(model, img_bytes):
    try:
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        print("ERROR: failed to open image:", e)
        return None, None

    img_np = np.array(img)

    try:
        results = model(img_np)
    except Exception as e:
        print("ERROR: YOLO inference failed:", e)
        return None, None

    try:
        annotated = results[0].plot()
        annotated_img = Image.fromarray(annotated[:, :, ::-1])  # BGR→RGB
    except Exception as e:
        print("ERROR: annotate failed:", e)
        return None, None

    detections = []
    try:
        h, w = results[0].orig_shape

        for box in results[0].boxes:
            cls_id = int(box.cls[0])
            cls_name = results[0].names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(float, box.xyxy[0])

            width = x2 - x1
            height = y2 - y1
            area = width * height

            severity = round((conf * 0.7 + (area / (h * w)) * 0.3) * 100, 2)

            detections.append({
                "class": cls_name,
                "confidence": round(conf * 100, 2),
                "bbox": {
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1),
                    "width": round(width, 1),
                    "height": round(height, 1),
                    "area": round(area, 1)
                },
                "severity": severity
            })

    except Exception as e:
        print("ERROR: detection parsing failed:", e)

    return annotated_img, detections
