from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from model_loader import load_model, run_inference
from video_processor import process_video
import tempfile
import os
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

model = load_model()  # load once!


SAFE_TEMP_DIR = tempfile.gettempdir()


def is_safe_temp_path(path):
    """Prevent directory traversal attacks."""
    return os.path.commonpath([os.path.abspath(path), SAFE_TEMP_DIR]) == SAFE_TEMP_DIR

from flask import Response

def send_video_with_range(path):
    file_size = os.path.getsize(path)
    range_header = request.headers.get("Range", None)
    byte1, byte2 = 0, None

    if range_header:
        range_value = range_header.replace("bytes=", "")
        parts = range_value.split("-")
        byte1 = int(parts[0])
        if len(parts) > 1 and parts[1].isdigit():
            byte2 = int(parts[1])

    length = file_size - byte1
    if byte2 is not None:
        length = byte2 - byte1 + 1

    with open(path, "rb") as f:
        f.seek(byte1)
        data = f.read(length)

    rv = Response(
        data,
        206,
        mimetype="video/mp4",
        content_type="video/mp4",
        direct_passthrough=True,
    )
    rv.headers.add("Content-Range", f"bytes {byte1}-{byte1 + length - 1}/{file_size}")

    return rv

@app.route("/api/detect", methods=["POST"])
def detect():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    img_bytes = request.files["image"].read()

    annotated_img, detections = run_inference(model, img_bytes)

    if annotated_img is None:
        return jsonify({"error": "Inference failed"}), 500

    temp_file = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    annotated_img.save(temp_file.name)

    # FIX: encode the windows path safely
    encoded_path = quote(temp_file.name)

    return jsonify({
        "image_url": f"http://127.0.0.1:5000/api/result_image?path={encoded_path}",
        "detections": detections
    })



@app.route("/api/result_image")
def result_image():
    path = request.args.get("path")

    if not is_safe_temp_path(path):
        return "Invalid file path", 403

    return send_file(path, mimetype="image/jpeg")


@app.route("/api/video", methods=["POST"])
def detect_video():
    if "video" not in request.files:
        return jsonify({"error": "No video uploaded"}), 400

    video_bytes = request.files["video"].read()

    output_path = process_video(video_bytes)

    if output_path is None:
        return jsonify({"error": "Video processing failed"}), 500

    return jsonify({
        "video_url": f"http://127.0.0.1:5000/api/result_video?path={quote(output_path)}",
    })


@app.route("/api/result_video")
def result_video():
    path = request.args.get("path")

    if not is_safe_temp_path(path):
        return "Invalid file path", 403

    # Enable range streaming
    return send_file(path, mimetype="video/mp4", conditional=True)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
