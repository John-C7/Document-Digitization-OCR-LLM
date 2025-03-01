#!/usr/bin/env python3
"""
version1.py
-----------
This script runs multiple OCR models on a given image and ensembles their outputs.
The models used are:
    - Custom OCR (using your htr_pipeline)
    - EasyOCR
    - DocTR
    - Tesseract (via pytesseract)
    - PaddleOCR

It then optionally passes the combined (ensemble) output to the Gemini API (LLM)
to add context and correct spelling errors. Benchmarking metrics (WER, CER, and
accuracy) are computed if ground truth is provided. Finally, the output is saved
to a PDF.
"""
import logging
import json
import cv2
import matplotlib.pyplot as plt
from path import Path
import tkinter as tk
from tkinter import filedialog
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import requests
from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
import numpy as np
import sys
from PIL import Image
import os
# ----- Imports for Multiple OCR Models -----
# Custom OCR model from your project:

this_dir = os.path.dirname(__file__)            # scripts/
parent_dir = os.path.abspath(os.path.join(this_dir, '..'))  # The directory above scripts/
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
# ----- Imports for Multiple OCR Models -----
# Custom OCR model from your project:
from htr_pipeline import read_page, DetectorConfig, LineClusteringConfig, ReaderConfig, PrefixTree

# EasyOCR
# import easyocr

# Tesseract OCR
# import pytesseract
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# PaddleOCR
# from paddleocr import PaddleOCR

# DocTR OCR (ensure you have doctr installed)
# from doctr.models import ocr_predictor

# -------------------------------
# Global Configurations and Setup
# -------------------------------
# Load configuration files for your custom OCR pipeline.
with open('../data/config.json') as f:
    sample_config = json.load(f)

with open('../data/words_alpha.txt') as f:
    word_list = [w.strip().upper() for w in f.readlines()]
prefix_tree = PrefixTree(word_list)

# Gemini API configuration (optional LLM enhancement)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

# Instantiate OCR model objects for those that require it.
# easyocr_reader = easyocr.Reader(['en'])
# paddleocr_model = PaddleOCR(lang="en")  # This may take some time to load.
# doctr_model = ocr_predictor(pretrained=True)  # DocTR model

# -------------------------------
# Gemini API Enhancement Function
# -------------------------------
# from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=4, max=10))
def call_gemini_api(input_text):
    """
    Sends the provided text to the Gemini API for enhancement (correct spelling and add context).
    Returns the enhanced text.
    """
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"Improve the spelling and add missing context to the following handwritten text:\n\n{input_text}"}
                ]
            }
        ]
    }
    headers = {"Content-Type": "application/json"}
    
    logging.info("Calling Gemini API with input: %s", input_text[:50])
    response = requests.post(GEMINI_URL, headers=headers, json=payload)
    logging.info("API response status: %d", response.status_code)
    
    if response.status_code == 200:
        try:
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            logging.error("Error parsing JSON: %s, Response: %s", e, response.text)
            return input_text
    elif response.status_code == 429:
        logging.warning("Rate limit exceeded, retrying...")
        raise Exception("Rate limit exceeded")
    else:
        logging.error("API Error: %d, Response: %s", response.status_code, response.text)
        if response.status_code == 404:
            logging.error("Model not found. Please check the model name in GEMINI_URL.")
        elif response.status_code == 403:
            logging.error("Invalid API key or insufficient permissions.")
        return input_text

# -------------------------------
# PDF Output Function
# -------------------------------
# def save_to_pdf(text, pdf_filename):
#     """
#     Saves the provided text to a PDF file.
#     """
#     c = canvas.Canvas(pdf_filename, pagesize=A4)
#     width, height = A4
#     textobject = c.beginText(50, height - 50)
#     textobject.setFont("Times-Roman", 12)
#     for line in text.split('\n'):
#         textobject.textLine(line)
#     c.drawText(textobject)
#     c.showPage()
#     c.save()
def save_to_pdf(text, pdf_filename):
    """
    Saves the provided text to a PDF file, handling multi-page output.
    """
    c = canvas.Canvas(pdf_filename, pagesize=A4)
    width, height = A4
    margin = 50
    line_height = 14  # Assuming 12pt font with some spacing
    max_lines_per_page = int((height - 2 * margin) / line_height)
    
    lines = text.split('\n')
    current_line = 0
    
    while current_line < len(lines):
        textobject = c.beginText(margin, height - margin)
        textobject.setFont("Times-Roman", 12)
        
        for _ in range(max_lines_per_page):
            if current_line >= len(lines):
                break
            textobject.textLine(lines[current_line])
            current_line += 1
        
        c.drawText(textobject)
        c.showPage()
    
    c.save()
# -------------------------------
# Benchmarking Utility Functions
# -------------------------------
def compute_edit_distance(ref_tokens, hyp_tokens):
    """
    Computes the edit distance (Levenshtein) between two sequences.
    """
    n = len(ref_tokens)
    m = len(hyp_tokens)
    dp = np.zeros((n + 1, m + 1), dtype=np.int32)
    
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref_tokens[i - 1] == hyp_tokens[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1,    # deletion
                           dp[i][j - 1] + 1,    # insertion
                           dp[i - 1][j - 1] + cost)  # substitution
    return dp[n][m]

def word_error_rate(ref, hyp):
    """
    Computes the Word Error Rate (WER) between reference and hypothesis.
    """
    ref_words = ref.split()
    hyp_words = hyp.split()
    if len(ref_words) == 0:
        return float('inf')
    distance = compute_edit_distance(ref_words, hyp_words)
    return distance / len(ref_words)

def char_error_rate(ref, hyp):
    """
    Computes the Character Error Rate (CER) between reference and hypothesis.
    """
    ref_chars = list(ref)
    hyp_chars = list(hyp)
    if len(ref_chars) == 0:
        return float('inf')
    distance = compute_edit_distance(ref_chars, hyp_chars)
    return distance / len(ref_chars)

def compute_accuracy(ref, error_rate):
    """
    Computes accuracy as (1 - error_rate) * 100%.
    """
    if ref.strip() == "":
        return 0.0
    return (1 - error_rate) * 100

# -------------------------------
# OCR Model Runner Functions
# -------------------------------
def run_custom_ocr(image, image_path):
    """
    Runs your custom OCR model from htr_pipeline.
    """
    config = sample_config.get(Path(image_path).basename(), {})
    scale = config.get('scale', 1)
    margin = config.get('margin', 0)
    read_lines = read_page(
        image,
        detector_config=DetectorConfig(scale=scale, margin=margin),
        line_clustering_config=LineClusteringConfig(min_words_per_line=2),
        reader_config=ReaderConfig(decoder='best_path', prefix_tree=prefix_tree)
    )
    custom_text = "\n".join([" ".join(word.text for word in line) for line in read_lines])
    return custom_text, read_lines

# def run_easyocr(image):
#     """
#     Runs EasyOCR on the image.
#     """
#     results = easyocr_reader.readtext(image)
#     texts = [res[1] for res in results]
#     return "\n".join(texts)

# def run_doctr(image_path):
#     """
#     Runs DocTR OCR on the image.
    
#     DocTR expects an image object (with shape (H, W, 3)). We now open the image using PIL,
#     convert it to RGB, and then pass it to the model.
#     """
#     image_pil = Image.open(image_path).convert("RGB")
#     result = doctr_model([image_pil])
#     exported = result.export()
#     lines = []
#     for page in exported.get("pages", []):
#         for block in page.get("blocks", []):
#             if "text" in block:
#                 lines.append(block["text"])
#     return "\n".join(lines)

def run_tesseract(image):
    """
    Runs Tesseract OCR.
    """
    return pytesseract.image_to_string(image)

# def run_paddleocr(image):
#     """
#     Runs PaddleOCR on the image.
#     """
#     result = paddleocr_model.ocr(image, rec=True)
#     lines = []
#     for line in result:
#         line_text = " ".join([word_info[-1] for word_info in line])
#         lines.append(line_text)
#     return "\n".join(lines)
# def run_paddleocr(image):
#     """
#     Runs PaddleOCR on the image.
    
#     This function converts the image to a numpy array and calls paddleocr_model.ocr().
#     It then extracts the recognized text from the result using the form:
#          result[0] is the first page,
#          each element in result[0] is a list with structure [box, (text, confidence)].
#     """
#     import numpy as np
#     # Convert image to numpy array (if not already one)
#     np_image = np.array(image)
#     result = paddleocr_model.ocr(np_image, rec=True)
#     # Assuming result[0] contains the detections for the first page.
#     text = "\n".join([line[1][0] for line in result[0]])
#     return text
    


# -------------------------------
# Utility: Image Upload using tkinter
# -------------------------------
def upload_image():
    """
    Uses tkinter to allow the user to select an image file.
    """
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select an Image for OCR",
        filetypes=[("Image files", "*.png;*.jpg;*.jpeg;*.bmp;*.tiff"), ("All files", "*.*")]
    )
    return file_path

# -------------------------------
# Ensemble Function
# -------------------------------
def ensemble_text(ocr_outputs):
    """
    Given a dictionary of OCR outputs (model_name: text),
    create an ensemble by concatenating the results with labels.
    """
    combined_lines = []
    for model_name, text in ocr_outputs.items():
        combined_lines.append(f"--- {model_name} Output ---")
        combined_lines.append(text)
        combined_lines.append("")
    return "\n".join(combined_lines)

# -------------------------------
# Main Pipeline Function
# -------------------------------
def main():
    print("Please select an image file for OCR processing:")
    image_path = upload_image()
    if not image_path:
        print("No image selected. Exiting.")
        sys.exit(0)
    print(f"Image selected: {image_path}")

    image_gray = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image_gray is None:
        print("Error loading the image.")
        sys.exit(1)

    print("Running Custom OCR model...")
    custom_text, custom_read_lines = run_custom_ocr(image_gray, image_path)
    # print("Running EasyOCR...")
    # easyocr_text = run_easyocr(image_gray)
    print("Running Tesseract OCR...")
    tesseract_text = run_tesseract(image_gray)
    # print("Running PaddleOCR...")
    # paddleocr_text = run_paddleocr(image_gray)

    ocr_results = {
        "Custom OCR": custom_text,
        "Tesseract": tesseract_text,
    }
    ensemble_result = ensemble_text(ocr_results)
    print("\n---- Ensemble OCR Output ----\n")
    print(ensemble_result)

    print("\nWould you like to run Gemini API (LLM enhancement) on the ensemble OCR output? (y/n): ", end="")
    enhance_choice = input().strip().lower()
    if enhance_choice == 'y':
        try:
            ensemble_enhanced = call_gemini_api(ensemble_result)
        except RetryError:
            logging.error("Failed to call Gemini API after 2 retries due to rate limits, using unenhanced text.")
            ensemble_enhanced = ensemble_result
    else:
        ensemble_enhanced = ensemble_result

    print("\n(Optional) Enter the ground truth text for benchmarking (or press Enter to skip):")
    ground_truth = input().strip()
    if ground_truth:
        metrics = {}
        for model, text in ocr_results.items():
            wer = word_error_rate(ground_truth, text)
            cer = char_error_rate(ground_truth, text)
            word_acc = compute_accuracy(ground_truth, wer)
            char_acc = compute_accuracy(ground_truth, cer)
            metrics[model] = {"WER": wer, "CER": cer, "Word Accuracy": word_acc, "Char Accuracy": char_acc}
        ensemble_wer = word_error_rate(ground_truth, ensemble_result)
        ensemble_cer = char_error_rate(ground_truth, ensemble_result)
        ensemble_word_acc = compute_accuracy(ground_truth, ensemble_wer)
        ensemble_char_acc = compute_accuracy(ground_truth, ensemble_cer)
        enhanced_wer = word_error_rate(ground_truth, ensemble_enhanced)
        enhanced_cer = char_error_rate(ground_truth, ensemble_enhanced)
        enhanced_word_acc = compute_accuracy(ground_truth, enhanced_wer)
        enhanced_char_acc = compute_accuracy(ground_truth, enhanced_cer)

        print("\n--- Benchmark Metrics ---\n")
        for model, stats in metrics.items():
            print(f"{model}:")
            print(f"  WER: {stats['WER']:.2f}, Word Accuracy: {stats['Word Accuracy']:.2f}%")
            print(f"  CER: {stats['CER']:.2f}, Char Accuracy: {stats['Char Accuracy']:.2f}%\n")
        print("Ensemble (Pre-LLM):")
        print(f"  WER: {ensemble_wer:.2f}, Word Accuracy: {ensemble_word_acc:.2f}%")
        print(f"  CER: {ensemble_cer:.2f}, Char Accuracy: {ensemble_char_acc:.2f}%\n")
        print("Ensemble (LLM Enhanced):")
        print(f"  WER: {enhanced_wer:.2f}, Word Accuracy: {enhanced_word_acc:.2f}%")
        print(f"  CER: {enhanced_cer:.2f}, Char Accuracy: {enhanced_char_acc:.2f}%\n")
    else:
        print("No ground truth provided; skipping benchmarking metrics.")

    final_pdf_filename = f"{Path(image_path).stem}_ensemble_output.pdf"
    save_to_pdf(ensemble_enhanced, final_pdf_filename)
    print(f"Saved the final output to PDF: {final_pdf_filename}")

    plt.figure(f'Custom OCR Detections - {Path(image_path).basename()}')
    plt.imshow(image_gray, cmap='gray')
    for i, line in enumerate(custom_read_lines):
        for word in line:
            aabb = word.aabb
            xs = [aabb.xmin, aabb.xmin, aabb.xmax, aabb.xmax, aabb.xmin]
            ys = [aabb.ymin, aabb.ymax, aabb.ymax, aabb.ymin, aabb.ymin]
            plt.plot(xs, ys, c='r' if i % 2 else 'b')
            plt.text(aabb.xmin, aabb.ymin - 2, word.text, color='black', fontsize=8)
    plt.title("Custom OCR Detections")
    plt.show()

if __name__ == "__main__":
    main()
