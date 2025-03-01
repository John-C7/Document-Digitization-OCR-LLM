"""
app.py
Handwritten Document Digitization System - RESTful API Server.
Coordinates image preprocessing, multi-model OCR ensemble (Custom CRNN-CTC,
EasyOCR, PaddleOCR, Tesseract), Gemini LLM contextual enhancement,
and multi-page PDF generation.
"""

import os
import sys
import uuid
import json
import logging
import cv2
import numpy as np
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# Configure path imports
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

HTR_DIR = BASE_DIR / "HTRPipeline"
if str(HTR_DIR) not in sys.path:
    sys.path.insert(0, str(HTR_DIR))

from backend.preprocessor import load_image, preprocess_for_ocr, image_to_base64
from backend.ensemble_engine import weighted_voting_ensemble, DEFAULT_WEIGHTS
from backend.llm_enhancer import enhance_with_gemini
from backend.metrics import compute_benchmarks
from backend.pdf_generator import generate_digitized_pdf

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("OCR-LLM-Server")

app = Flask(__name__)
CORS(app)

# Storage directories
UPLOAD_FOLDER = BASE_DIR / "backend" / "uploads"
OUTPUT_FOLDER = BASE_DIR / "backend" / "outputs"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------
# Lazy / Safe Initializations of OCR Engines
# -------------------------------------------------------------
# 1. Custom CRNN-CTC from htr_pipeline
custom_ocr_available = False
try:
    from htr_pipeline import read_page, DetectorConfig, LineClusteringConfig, ReaderConfig, PrefixTree

    # Attempt to load dictionary for word beam search
    dict_paths = [
        BASE_DIR / "data" / "words_alpha.txt",
        HTR_DIR / "data" / "words_alpha.txt"
    ]
    prefix_tree = None
    for dp in dict_paths:
        if dp.exists():
            with open(dp) as f:
                words = [w.strip().upper() for w in f.readlines()]
            prefix_tree = PrefixTree(words)
            break
    custom_ocr_available = True
    logger.info("Custom CRNN-CTC (htr_pipeline) loaded successfully.")
except Exception as e:
    logger.warning(f"Could not load custom htr_pipeline: {e}")

# 2. Tesseract OCR
tesseract_available = False
try:
    import pytesseract
    tess_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    if os.path.exists(tess_path):
        pytesseract.pytesseract.tesseract_cmd = tess_path
    tesseract_available = True
    logger.info("Tesseract OCR initialized.")
except Exception as e:
    logger.warning(f"Tesseract initialization notice: {e}")

# 3. EasyOCR
easyocr_reader = None
try:
    import easyocr
    easyocr_reader = easyocr.Reader(['en'], gpu=False)
    logger.info("EasyOCR initialized.")
except Exception as e:
    logger.warning(f"EasyOCR initialization notice: {e}")

# 4. PaddleOCR
paddleocr_model = None
try:
    from paddleocr import PaddleOCR
    paddleocr_model = PaddleOCR(use_angle_cls=False, lang='en', show_log=False)
    logger.info("PaddleOCR initialized.")
except Exception as e:
    logger.warning(f"PaddleOCR initialization notice: {e}")


# -------------------------------------------------------------
# Individual OCR Worker Functions
# -------------------------------------------------------------
def run_custom_crnn(gray_img):
    """Executes the Custom CRNN-CTC model and extracts word bounding boxes."""
    if not custom_ocr_available:
        return "", []
    try:
        read_lines = read_page(
            gray_img,
            detector_config=DetectorConfig(scale=0.4, margin=1),
            line_clustering_config=LineClusteringConfig(min_words_per_line=1),
            reader_config=ReaderConfig(decoder='best_path', prefix_tree=prefix_tree)
        )
        lines_text = []
        boxes = []
        for line in read_lines:
            line_words = []
            for word in line:
                line_words.append(word.text)
                aabb = word.aabb
                boxes.append({
                    "text": word.text,
                    "x": int(aabb.xmin),
                    "y": int(aabb.ymin),
                    "w": int(aabb.xmax - aabb.xmin),
                    "h": int(aabb.ymax - aabb.ymin)
                })
            lines_text.append(" ".join(line_words))
        return "\n".join(lines_text), boxes
    except Exception as ex:
        logger.error(f"Error in Custom CRNN-CTC: {ex}")
        return "", []


def run_easyocr_runner(bgr_img):
    """Executes EasyOCR text extraction."""
    if not easyocr_reader:
        return ""
    try:
        results = easyocr_reader.readtext(bgr_img)
        return "\n".join([res[1] for res in results])
    except Exception as ex:
        logger.error(f"Error in EasyOCR: {ex}")
        return ""


def run_paddleocr_runner(bgr_img):
    """Executes PaddleOCR text extraction."""
    if not paddleocr_model:
        return ""
    try:
        result = paddleocr_model.ocr(bgr_img, cls=False)
        lines = []
        if result and result[0]:
            for line in result[0]:
                lines.append(line[1][0])
        return "\n".join(lines)
    except Exception as ex:
        logger.error(f"Error in PaddleOCR: {ex}")
        return ""


def run_tesseract_runner(gray_img):
    """Executes Tesseract OCR text extraction."""
    if not tesseract_available:
        return ""
    try:
        return pytesseract.image_to_string(gray_img).strip()
    except Exception as ex:
        logger.error(f"Error in Tesseract: {ex}")
        return ""


def draw_bounding_boxes(image_bgr, boxes):
    """Annotates image with detected word bounding boxes and text labels."""
    annotated = image_bgr.copy()
    for b in boxes:
        x, y, w, h = b["x"], b["y"], b["w"], b["h"]
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 165, 255), 2)
        cv2.putText(annotated, b["text"], (x, max(12, y - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 60, 0), 1, cv2.LINE_AA)
    return annotated


# -------------------------------------------------------------
# REST API Endpoints
# -------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health_check():
    """Returns system status and active OCR engines."""
    return jsonify({
        "status": "healthy",
        "engines": {
            "custom_crnn_ctc": custom_ocr_available,
            "easyocr": easyocr_reader is not None,
            "paddleocr": paddleocr_model is not None,
            "tesseract": tesseract_available
        }
    })


@app.route("/upload", methods=["POST"])
@app.route("/api/process", methods=["POST"])
def process_document():
    """
    Main document digitization pipeline endpoint.
    Processes uploaded handwritten document through:
      1. Preprocessing (Grayscale, Gaussian Blur, Otsu)
      2. Multi-Model OCR (CRNN-CTC, EasyOCR, PaddleOCR, Tesseract in parallel)
      3. ROVER Weighted Voting Ensemble
      4. Gemini LLM Contextual Enhancement
      5. Bounding Box Detection Visualization
      6. Multi-page PDF Generation
      7. Benchmark Evaluation (if ground truth supplied)
    """
    if "image" not in request.files and "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded under 'image' or 'file'"}), 400

    uploaded_file = request.files.get("image") or request.files.get("file")
    if uploaded_file.filename == "":
        return jsonify({"success": False, "error": "Uploaded filename is empty"}), 400

    # User options
    enable_llm = request.form.get("enable_llm", "true").lower() in ("true", "1", "yes")
    ground_truth = request.form.get("ground_truth", "").strip()
    gemini_key = request.form.get("gemini_api_key", "").strip() or None

    weights = DEFAULT_WEIGHTS.copy()
    raw_weights = request.form.get("weights")
    if raw_weights:
        try:
            parsed = json.loads(raw_weights)
            weights.update(parsed)
        except Exception as e:
            logger.warning(f"Could not parse custom weights: {e}")

    try:
        # Load and preprocess image
        bgr_img, gray_img = load_image(uploaded_file)
        prep_data = preprocess_for_ocr(gray_img)

        # Run models in parallel using ThreadPoolExecutor
        boxes = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            future_custom = executor.submit(run_custom_crnn, gray_img)
            future_easy = executor.submit(run_easyocr_runner, bgr_img)
            future_paddle = executor.submit(run_paddleocr_runner, bgr_img)
            future_tess = executor.submit(run_tesseract_runner, prep_data["binary"])

            custom_text, boxes = future_custom.result()
            easy_text = future_easy.result()
            paddle_text = future_paddle.result()
            tess_text = future_tess.result()

        ocr_outputs = {
            "Custom CRNN-CTC": custom_text,
            "EasyOCR": easy_text,
            "PaddleOCR": paddle_text,
            "Tesseract": tess_text
        }

        # Weighted Voting Consensus (ROVER)
        ensemble_text, confidence_score = weighted_voting_ensemble(
            ocr_outputs,
            model_weights=weights,
            reference_model="Custom CRNN-CTC"
        )

        # Gemini LLM Contextual Enhancement
        enhanced_text = None
        llm_status = None
        if enable_llm:
            llm_res = enhance_with_gemini(ensemble_text, api_key=gemini_key)
            enhanced_text = llm_res["enhanced_text"]
            llm_status = llm_res["error"]

        final_text = enhanced_text if (enable_llm and enhanced_text) else ensemble_text

        # Bounding box detection visualization
        annotated_bgr = draw_bounding_boxes(bgr_img, boxes)
        annotated_b64 = image_to_base64(annotated_bgr)

        # PDF Generation
        doc_id = str(uuid.uuid4())[:8]
        pdf_filename = f"digitized_{doc_id}.pdf"
        pdf_path = OUTPUT_FOLDER / pdf_filename
        generate_digitized_pdf(
            text=final_text,
            output_path=str(pdf_path),
            doc_title=Path(uploaded_file.filename).stem,
            confidence_score=confidence_score
        )

        # Benchmarks
        benchmarks = {}
        if ground_truth:
            benchmarks = compute_benchmarks(ground_truth, ocr_outputs, ensemble_text, enhanced_text)

        return jsonify({
            "success": True,
            "preprocessed_image": prep_data["base64_preview"],
            "visualized_image": annotated_b64,
            "ocr_outputs": ocr_outputs,
            "ensemble_text": ensemble_text,
            "confidence_score": confidence_score,
            "llm_enhanced_text": enhanced_text,
            "final_text": final_text,
            "pdf_url": f"/api/download/{pdf_filename}",
            "benchmarks": benchmarks,
            "detected_boxes_count": len(boxes),
            "llm_error": llm_status
        })

    except Exception as ex:
        logger.exception("Processing failed:")
        return jsonify({"success": False, "error": str(ex)}), 500


@app.route("/api/download/<filename>", methods=["GET"])
def download_pdf(filename):
    """Serves the generated PDF file for download."""
    target_path = OUTPUT_FOLDER / filename
    if target_path.exists():
        return send_file(target_path, as_attachment=True, download_name=filename)
    return jsonify({"error": "File not found"}), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting Document Digitization Backend on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
