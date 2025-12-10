/* Unified frontend script for image + video detection */
const backendBase = "http://127.0.0.1:5000";

const dropArea = document.getElementById("drop-area");
const fileInput = document.getElementById("file-input");

const detectBtn = document.getElementById("detect-btn");
const videoDetectBtn = document.getElementById("video-detect-btn");

const spinner = document.getElementById("spinner");
const statusRow = document.getElementById("status-row");
const statusText = document.getElementById("status-text");

const originalImg = document.getElementById("original-img");
const resultImg = document.getElementById("result-img");
const originalVideo = document.getElementById("original-video");
const resultVideo = document.getElementById("result-video");

const summaryList = document.getElementById("summary-list");
const uploadHelper = document.getElementById("upload-helper");

let currentFile = null;
let currentMode = null; // "image" or "video"

function resetUIKeepUpload() {
    // Hide media displays and summary
    originalImg.classList.add("hidden");
    resultImg.classList.add("hidden");
    originalVideo.classList.add("hidden");
    resultVideo.classList.add("hidden");
    summaryList.innerHTML = "";
    detectBtn.disabled = true;
    videoDetectBtn.disabled = true;
    currentFile = null;
    currentMode = null;
    statusRow.classList.add("hidden");
}

function setStatus(visible, text) {
    if (visible) {
        statusRow.classList.remove("hidden");
        statusText.innerText = text || "Processing...";
    } else {
        statusRow.classList.add("hidden");
    }
}

function handleFile(file) {
    // reset results for new file
    summaryList.innerHTML = "";
    resultImg.src = "";
    resultVideo.src = "";
    resultImg.classList.add("hidden");
    resultVideo.classList.add("hidden");

    currentFile = file;
    const type = file.type || "";
    if (type.startsWith("image")) {
        currentMode = "image";
        detectBtn.disabled = false;
        videoDetectBtn.disabled = true;

        // show image preview
        originalVideo.classList.add("hidden");
        originalVideo.src = "";
        originalImg.src = URL.createObjectURL(file);
        originalImg.classList.remove("hidden");
        uploadHelper.innerText = "Image ready — click Run Image Detection";
    } else if (type.startsWith("video")) {
        currentMode = "video";
        detectBtn.disabled = true;
        videoDetectBtn.disabled = false;

        // show video preview
        originalImg.classList.add("hidden");
        originalImg.src = "";
        originalVideo.src = URL.createObjectURL(file);
        originalVideo.classList.remove("hidden");
        uploadHelper.innerText = "Video ready — click Run Video Detection";
    } else {
        alert("Unsupported file type. Please upload an image or video.");
        resetUIKeepUpload();
    }
}

/* Drag & Drop */
dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("active");
});
dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("active");
});
dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("active");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
});

/* Click opens file picker */
dropArea.addEventListener("click", () => {
    fileInput.value = ""; // allow same file selection again
    fileInput.click();
});

/* keyboard accessibility: Enter/Space triggers file dialog */
dropArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
    }
});

/* File picker */
fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
});

/* Image detection */
detectBtn.addEventListener("click", async () => {
    if (!currentFile || currentMode !== "image") return;

    setStatus(true, "Running image detection...");
    detectBtn.disabled = true;
    videoDetectBtn.disabled = true;

    const form = new FormData();
    form.append("image", currentFile);

    try {
        const res = await fetch(`${backendBase}/api/detect`, {
            method: "POST",
            body: form
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();

        // show processed image from backend
        resultImg.src = data.image_url;
        resultImg.classList.remove("hidden");

        // render summary
        renderSummary(data.detections);
        setStatus(false);
    } catch (err) {
        console.error("Image detection failed:", err);
        setStatus(false);
        alert("Image detection failed. Check backend logs and CORS.");
    } finally {
        detectBtn.disabled = false;
    }
});

/* Video detection */
videoDetectBtn.addEventListener("click", async () => {
    if (!currentFile || currentMode !== "video") return;

    setStatus(true, "Processing video (this may take a while)...");
    detectBtn.disabled = true;
    videoDetectBtn.disabled = true;

    const form = new FormData();
    form.append("video", currentFile);

    try {
        const res = await fetch(`${backendBase}/api/video`, {
            method: "POST",
            body: form
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();

        // show processed video
        resultVideo.src = data.video_url;
        resultVideo.classList.remove("hidden");
        // optionally auto-play
        resultVideo.addEventListener("canplay", () => resultVideo.play(), { once: true });

        // clear any summary (or show a simple notice)
        summaryList.innerHTML = `<div class="summary-item">Video processed — open the processed video to inspect detections.</div>`;
        setStatus(false);
    } catch (err) {
        console.error("Video detection failed:", err);
        setStatus(false);
        alert("Video detection failed. Check backend logs and available codecs.");
    } finally {
        videoDetectBtn.disabled = false;
    }
});

/* Render detection summary (image mode) */
function renderSummary(detections) {
    summaryList.innerHTML = "";
    if (!detections || detections.length === 0) {
        summaryList.innerHTML = `<div class="summary-item">No damage detected.</div>`;
        return;
    }
    detections.forEach((det, i) => {
        const html = `
        <div class="summary-item">
            <div class="det-title">
                <span class="det-label">Damage Type:</span> ${det.class}
            </div>

            <table class="det-table">
                <tr><td>Confidence:</td><td>${det.confidence}%</td></tr>
                <tr><td>Severity Score:</td><td>${det.severity} / 100</td></tr>
            </table>

            <div class="det-sub">Bounding Box</div>

            <table class="det-table">
                <tr><td>Coordinates:</td>
                    <td>(${det.bbox.x1}, ${det.bbox.y1}) → (${det.bbox.x2}, ${det.bbox.y2})</td>
                </tr>
                <tr><td>Size:</td>
                    <td>${det.bbox.width} × ${det.bbox.height} px</td>
                </tr>
                <tr><td>Area:</td>
                    <td>${det.bbox.area} px²</td>
                </tr>
            </table>
        </div>
        `;
        summaryList.insertAdjacentHTML("beforeend", html);
    });
}

/* Initialize UI */
resetUIKeepUpload();
