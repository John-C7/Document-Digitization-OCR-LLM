#!/usr/bin/env python3
"""
ensemble.py
-----------
This script runs multiple OCR models on a given image and ensembles their outputs using weighted majority voting.
The models used are:
    - Custom OCR (using your htr_pipeline)
    - EasyOCR
    - Tesseract (via pytesseract)
    - PaddleOCR

It prints the individual outputs of all four OCR models, followed by the ensemble result.
Optionally, it passes the ensemble output to the Gemini API (LLM) to add context and correct spelling errors.
Benchmarking metrics (WER, CER, and accuracy) are computed if ground truth is provided.
Finally, the output is saved to a PDF.
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
from collections import defaultdict

# ----- Imports for Multiple OCR Models -----
this_dir = os.path.dirname(__file__)
parent_dir = os.path.abspath(os.path.join(this_dir, '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from htr_pipeline import read_page, DetectorConfig, LineClusteringConfig, ReaderConfig, PrefixTree
import easyocr
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from paddleocr import PaddleOCR

# -------------------------------
# Global Configurations and Setup
# -------------------------------
with open('../data/config.json') as f:
    sample_config = json.load(f)

with open('../data/words_alpha.txt') as f:
    word_list = [w.strip().upper() for w in f.readlines()]
prefix_tree = PrefixTree(word_list)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

easyocr_reader = easyocr.Reader(['en'])
paddleocr_model = PaddleOCR(lang="en")

# -------------------------------
# Gemini API Enhancement Function
# -------------------------------
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
        return input_text

# -------------------------------
# PDF Output Function
# -------------------------------
def save_to_pdf(text, pdf_filename):
    """
    Saves the provided text to a PDF file, handling multi-page output.
    """
    c = canvas.Canvas(pdf_filename, pagesize=A4)
    width, height = A4
    margin = 50
    line_height = 14
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
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    return dp[n][m]

def word_error_rate(ref, hyp):
    ref_words = ref.split()
    hyp_words = hyp.split()
    if len(ref_words) == 0:
        return float('inf')
    distance = compute_edit_distance(ref_words, hyp_words)
    return distance / len(ref_words)

def char_error_rate(ref, hyp):
    ref_chars = list(ref)
    hyp_chars = list(hyp)
    if len(ref_chars) == 0:
        return float('inf')
    distance = compute_edit_distance(ref_chars, hyp_chars)
    return distance / len(ref_chars)

def compute_accuracy(ref, error_rate):
    if ref.strip() == "":
        return 0.0
    return (1 - error_rate) * 100

# -------------------------------
# OCR Model Runner Functions
# -------------------------------
def run_custom_ocr(image, image_path):
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

def run_easyocr(image):
    results = easyocr_reader.readtext(image)
    texts = [res[1] for res in results]
    return "\n".join(texts)

def run_tesseract(image):
    return pytesseract.image_to_string(image)

def run_paddleocr(image):
    np_image = np.array(image)
    result = paddleocr_model.ocr(np_image, rec=True)
    text = "\n".join([line[1][0] for line in result[0]])
    return text

# -------------------------------
# Utility: Image Upload using tkinter
# -------------------------------
def upload_image():
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select an Image for OCR",
        filetypes=[("Image files", "*.png;*.jpg;*.jpeg;*.bmp;*.tiff"), ("All files", "*.*")]
    )
    return file_path

# -------------------------------
# Weighted Majority Voting Ensemble Function
# -------------------------------
def weighted_voting_ensemble(ocr_outputs, model_weights, reference_model="Custom OCR"):
    """
    Ensemble OCR outputs using weighted majority voting.
    
    Args:
        ocr_outputs (dict): Dictionary with model names as keys and their text outputs as values.
        model_weights (dict): Dictionary with model names as keys and their weights as values.
        reference_model (str): Name of the model to use as reference (default: "Custom OCR").
    
    Returns:
        str: The ensembled text result.
    """
    reference_text = ocr_outputs[reference_model]
    reference_lines = reference_text.split('\n')
    num_lines = len(reference_lines)
    models = list(ocr_outputs.keys())

    aligned_lines = {}
    for model in models:
        lines = ocr_outputs[model].split('\n')
        if len(lines) < num_lines:
            lines += [''] * (num_lines - len(lines))
        else:
            lines = lines[:num_lines]
        aligned_lines[model] = lines

    ensembled_lines = []
    for i in range(num_lines):
        line_i = {model: aligned_lines[model][i] for model in models}
        max_length = max(len(line_i[model]) for model in models)
        padded_lines = {model: line_i[model].ljust(max_length) for model in models}

        ensembled_line = []
        for j in range(max_length):
            char_votes = defaultdict(float)
            for model in models:
                char = padded_lines[model][j]
                char_votes[char] += model_weights[model]

            max_vote = max(char_votes.values())
            candidates = [char for char, vote in char_votes.items() if vote == max_vote]
            if len(candidates) == 1:
                chosen_char = candidates[0]
            else:
                ref_char = padded_lines[reference_model][j]
                chosen_char = ref_char if ref_char in candidates else candidates[0]
            ensembled_line.append(chosen_char)

        ensembled_line_str = ''.join(ensembled_line).rstrip()
        ensembled_lines.append(ensembled_line_str)

    return '\n'.join(ensembled_lines)

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
    print("Running EasyOCR...")
    easyocr_text = run_easyocr(image_gray)
    print("Running Tesseract OCR...")
    tesseract_text = run_tesseract(image_gray)
    print("Running PaddleOCR...")
    paddleocr_text = run_paddleocr(image_gray)

    ocr_results = {
        "Custom OCR": custom_text,
        "EasyOCR": easyocr_text,
        "Tesseract": tesseract_text,
        "PaddleOCR": paddleocr_text
    }

    # Define model weights (equal weights for now)
    model_weights = {
        "Custom OCR": 1.0,
        "EasyOCR": 1.0,
        "Tesseract": 1.0,
        "PaddleOCR": 1.0
    }

    # Print individual OCR outputs
    print("\n---- Individual OCR Outputs ----\n")
    for model_name, text in ocr_results.items():
        print(f"--- {model_name} Output ---")
        print(text)
        print()

    # Generate and print the ensemble result
    ensemble_result = weighted_voting_ensemble(ocr_results, model_weights)
    print("---- Ensemble OCR Output (Weighted Majority Voting) ----\n")
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