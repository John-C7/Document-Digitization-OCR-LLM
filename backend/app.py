"""
app.py
Handwritten Document Digitization System - RESTful API Server.
Coordinates advanced multi-stage image preprocessing, multi-model OCR ensemble
(Custom CRNN-CTC, EasyOCR, PaddleOCR, Tesseract), Gemini LLM contextual enhancement
(Gemini 2.5/2.0/1.5 Flash & Pro with multi-modal visual grounding),
ROVER dynamic alignment, benchmarking, and multi-format document export.
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
DATA_FOLDER = BASE_DIR / "data"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------
# Lazy / Safe Initializations of OCR Engines
# -------------------------------------------------------------
# 1. Custom CRNN-CTC from htr_pipeline
custom_ocr_available = False
prefix_tree = None
try:
    from htr_pipeline import read_page, DetectorConfig, LineClusteringConfig, ReaderConfig, PrefixTree

    dict_paths = [
        DATA_FOLDER / "words_alpha.txt",
        HTR_DIR / "data" / "words_alpha.txt"
    ]
    for dp in dict_paths:
        if dp.exists():
            with open(dp, "r", encoding="utf-8", errors="ignore") as f:
                words = [w.strip().upper() for w in f.readlines() if w.strip()]
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


def run_tesseract_runner(binary_img):
    """Executes Tesseract OCR text extraction."""
    if not tesseract_available:
        return ""
    try:
        return pytesseract.image_to_string(binary_img).strip()
    except Exception as ex:
        logger.error(f"Error in Tesseract: {ex}")
        return ""


def draw_bounding_boxes(image_bgr, boxes):
    """Annotates image with detected word bounding boxes and text labels."""
    annotated = image_bgr.copy()
    for b in boxes:
        x, y, w, h = b["x"], b["y"], b["w"], b["h"]
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 165, 255), 2)
        cv2.putText(
            annotated, b["text"], (x, max(14, y - 4)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 60, 0), 1, cv2.LINE_AA
        )
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
        },
        "supported_llm_models": [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ],
        "presets": ["standard", "historical", "form", "tabular"]
    })


@app.route("/api/samples", methods=["GET"])
def list_samples():
    """Returns list of bundled test handwritten images with descriptions."""
    samples = [
        {"id": "sample_1.png", "title": "Sample 1: Handwritten Letter / Note", "filename": "sample_1.png"},
        {"id": "sample_2.png", "title": "Sample 2: Degraded Historical Document", "filename": "sample_2.png"},
        {"id": "sample_2_line.png", "title": "Sample 3: Single Line Cursive Crop", "filename": "sample_2_line.png"}
    ]
    return jsonify({"success": True, "samples": samples})


@app.route("/api/samples/<filename>", methods=["GET"])
def get_sample_file(filename):
    """Serves a bundled sample image file."""
    for folder in [DATA_FOLDER, HTR_DIR / "data"]:
        target = folder / filename
        if target.exists():
            return send_file(target, mimetype="image/png")
    return jsonify({"error": "Sample not found"}), 404


@app.route("/upload", methods=["POST"])
@app.route("/api/process", methods=["POST"])
def process_document():
    """
    Main document digitization pipeline endpoint.
    Processes uploaded handwritten document through:
      1. Advanced multi-stage preprocessing (deskew, shadow removal, CLAHE, binarization)
      2. Multi-Model OCR (CRNN-CTC, EasyOCR, PaddleOCR, Tesseract) in parallel
      3. ROVER Dynamic Sequence Alignment Consensus
      4. Contextual & Multi-modal Gemini LLM Enhancement
      5. Multi-format Document Generation (PDF, Markdown, JSON, TXT)
      6. Benchmarking & Text Diff computation
    """
    if "image" not in request.files and "file" not in request.files:
        # Check if sample_name was passed
        sample_name = request.form.get("sample_name")
        if sample_name:
            sample_path = DATA_FOLDER / sample_name
            if not sample_path.exists():
                sample_path = HTR_DIR / "data" / sample_name
            if not sample_path.exists():
                return jsonify({"success": False, "error": f"Sample {sample_name} not found"}), 404
            with open(sample_path, "rb") as f:
                img_bytes = f.read()
            bgr_img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            gray_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
            doc_title = Path(sample_name).stem
        else:
            return jsonify({"success": False, "error": "No file uploaded under 'image' or 'file'"}), 400
    else:
        uploaded_file = request.files.get("image") or request.files.get("file")
        if uploaded_file.filename == "":
            return jsonify({"success": False, "error": "Uploaded filename is empty"}), 400
        bgr_img, gray_img = load_image(uploaded_file)
        doc_title = Path(uploaded_file.filename).stem

    # User options
    enable_llm = request.form.get("enable_llm", "true").lower() in ("true", "1", "yes")
    ground_truth = request.form.get("ground_truth", "").strip()
    gemini_key = request.form.get("gemini_api_key", "").strip() or None
    llm_model = request.form.get("model_name", "gemini-2.5-flash").strip()
    processing_mode = request.form.get("mode", "standard").strip()
    apply_deskew = request.form.get("apply_deskew", "true").lower() in ("true", "1", "yes")
    apply_shadow_removal = request.form.get("apply_shadow_removal", "true").lower() in ("true", "1", "yes")
    binarization_method = request.form.get("binarization_method", "otsu").strip()
    vision_assisted = request.form.get("vision_assisted", "false").lower() in ("true", "1", "yes")

    weights = DEFAULT_WEIGHTS.copy()
    raw_weights = request.form.get("weights")
    if raw_weights:
        try:
            parsed = json.loads(raw_weights)
            weights.update(parsed)
        except Exception as e:
            logger.warning(f"Could not parse custom weights: {e}")

    try:
        # 1. Advanced Multi-stage Preprocessing
        prep_data = preprocess_for_ocr(
            gray_img,
            apply_deskew=apply_deskew,
            apply_shadow_removal=apply_shadow_removal,
            binarization_method=binarization_method
        )
        processed_binary = prep_data["binary"]
        processed_gray = prep_data["enhanced_gray"]

        # 2. Parallel OCR Model Inference
        boxes = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            future_custom = executor.submit(run_custom_crnn, processed_gray)
            future_easy = executor.submit(run_easyocr_runner, bgr_img)
            future_paddle = executor.submit(run_paddleocr_runner, bgr_img)
            future_tess = executor.submit(run_tesseract_runner, processed_binary)

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

        # 3. ROVER Dynamic Sequence Alignment Consensus
        ensemble_text, confidence_score, ensemble_meta = weighted_voting_ensemble(
            ocr_outputs,
            model_weights=weights,
            reference_model="Custom CRNN-CTC"
        )

        # 4. Contextual Gemini LLM Enhancement
        enhanced_text = None
        llm_status = None
        diff_data = []
        model_used = None

        if enable_llm and ensemble_text:
            image_b64 = prep_data["stages"]["original"] if vision_assisted else None
            llm_res = enhance_with_gemini(
                ensemble_text,
                api_key=gemini_key,
                model_name=llm_model,
                mode=processing_mode,
                image_base64=image_b64
            )
            enhanced_text = llm_res["enhanced_text"]
            llm_status = llm_res.get("error")
            diff_data = llm_res.get("diff", [])
            model_used = llm_res.get("model_used")

        final_text = enhanced_text if (enable_llm and enhanced_text) else ensemble_text

        # 5. Bounding Box Detection Visualization
        annotated_bgr = draw_bounding_boxes(bgr_img, boxes)
        annotated_b64 = image_to_base64(annotated_bgr)

        # 6. Multi-format Document Export
        doc_id = str(uuid.uuid4())[:8]
        base_name = f"digitized_{doc_id}"

        # PDF Export
        pdf_filename = f"{base_name}.pdf"
        pdf_path = OUTPUT_FOLDER / pdf_filename
        generate_digitized_pdf(
            text=final_text,
            output_path=str(pdf_path),
            doc_title=doc_title,
            confidence_score=confidence_score,
            model_info=f"ROVER 4-Model Ensemble + {model_used or 'Gemini LLM'}"
        )

        # Plain Text Export
        txt_filename = f"{base_name}.txt"
        with open(OUTPUT_FOLDER / txt_filename, "w", encoding="utf-8") as f:
            f.write(final_text)

        # Markdown Export
        md_filename = f"{base_name}.md"
        with open(OUTPUT_FOLDER / md_filename, "w", encoding="utf-8") as f:
            f.write(f"# {doc_title}\n\n**Confidence**: {confidence_score}%\n\n---\n\n{final_text}\n")

        # JSON Export
        json_filename = f"{base_name}.json"
        export_payload = {
            "title": doc_title,
            "confidence_score": confidence_score,
            "final_text": final_text,
            "ensemble_text": ensemble_text,
            "llm_enhanced_text": enhanced_text,
            "ocr_outputs": ocr_outputs,
            "model_weights": weights,
            "diff": diff_data,
            "deskew_angle": prep_data["deskew_angle"]
        }
        with open(OUTPUT_FOLDER / json_filename, "w", encoding="utf-8") as f:
            json.dump(export_payload, f, indent=2)

        # 7. Benchmarks
        benchmarks = {}
        if ground_truth:
            benchmarks = compute_benchmarks(ground_truth, ocr_outputs, ensemble_text, enhanced_text)

        return jsonify({
            "success": True,
            "preprocessed_image": prep_data["base64_preview"],
            "preprocessing_stages": prep_data["stages"],
            "deskew_angle": prep_data["deskew_angle"],
            "visualized_image": annotated_b64,
            "ocr_outputs": ocr_outputs,
            "ensemble_text": ensemble_text,
            "ensemble_meta": ensemble_meta,
            "confidence_score": confidence_score,
            "llm_enhanced_text": enhanced_text,
            "final_text": final_text,
            "diff": diff_data,
            "llm_model_used": model_used,
            "pdf_url": f"/api/download/{pdf_filename}",
            "txt_url": f"/api/download/{txt_filename}",
            "md_url": f"/api/download/{md_filename}",
            "json_url": f"/api/download/{json_filename}",
            "benchmarks": benchmarks,
            "detected_boxes_count": len(boxes),
            "llm_error": llm_status
        })

    except Exception as ex:
        logger.exception("Processing pipeline failed:")
        return jsonify({"success": False, "error": str(ex)}), 500


@app.route("/api/download/<filename>", methods=["GET"])
def download_artifact(filename):
    """Serves the generated export artifacts (PDF, TXT, MD, JSON)."""
    target_path = OUTPUT_FOLDER / filename
    if target_path.exists():
        mimetypes = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".json": "application/json"
        }
        ext = target_path.suffix.lower()
        return send_file(
            target_path,
            as_attachment=True,
            download_name=filename,
            mimetype=mimetypes.get(ext, "application/octet-stream")
        )
    return jsonify({"error": "File not found"}), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting Document Digitization Backend on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
