#!/usr/bin/env python3
"""
custom_ocr_pdf_batch.py
-----------------
This script runs ONLY the custom OCR model (htr_pipeline) on a given
image OR multi-page PDF and saves the recognized text to a PDF file.
"""

import json
import cv2
from path import Path
import tkinter as tk
from tkinter import filedialog
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import sys
import os
from pdf2image import convert_from_path   # <--- for PDF page conversion
POPPLER_PATH = r"C:\poppler-25.07.0\Library\bin"
# import matplotlib.pyplot as plt   # (disabled for speed)
from paddleocr import PaddleOCR
ocr_model = PaddleOCR(use_angle_cls=True, lang='en')
# -------------------------------
# Imports for Custom OCR Model
# -------------------------------
this_dir = os.path.dirname(__file__)            # scripts/
parent_dir = os.path.abspath(os.path.join(this_dir, '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from htr_pipeline import read_page, DetectorConfig, LineClusteringConfig, ReaderConfig, PrefixTree

# -------------------------------
# Load Configurations
# -------------------------------
with open('../data/config.json') as f:
    sample_config = json.load(f)

with open('../data/words_alpha.txt') as f:
    word_list = [w.strip().upper() for w in f.readlines()]
prefix_tree = PrefixTree(word_list)

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
# Run Custom OCR
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
    return custom_text

# -------------------------------
# Utility: File Upload
# -------------------------------
def upload_file():
    """
    Uses tkinter to allow the user to select a PDF or image file.
    """
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select a PDF or Image for OCR",
        filetypes=[("PDF files", "*.pdf"),
                   ("Image files", "*.png;*.jpg;*.jpeg;*.bmp;*.tiff"),
                   ("All files", "*.*")]
    )
    return file_path
##################### PADDLE OCR######################

def run_paddleocr(image):
    """
    Runs PaddleOCR on an image (numpy array).
    """
    result = ocr_model.ocr(image, cls=True)
    lines = []
    for page in result:
        for line in page:
            lines.append(line[1][0])  # Extract recognized text
    return "\n".join(lines)

def process_pdf(file_path):
    pages = convert_from_path(file_path, dpi=300, poppler_path=POPPLER_PATH)
    all_text = []
    for i, page in enumerate(pages, start=1):
        print(f"Processing page {i}/{len(pages)}...")
        img = cv2.cvtColor(np.array(page), cv2.COLOR_RGB2BGR)
        page_text = run_paddleocr(img)
        all_text.append(f"--- Page {i} ---\n{page_text}\n")
    return "\n".join(all_text)
# -------------------------------
# Main Pipeline
# -------------------------------
def main():
    print("Please select a PDF or Image file for OCR processing:")
    file_path = upload_file()
    if not file_path:
        print("No file selected. Exiting.")
        sys.exit(0)
    print(f"File selected: {file_path}")

    all_text = []

    if file_path.lower().endswith(".pdf"):
        print("Converting PDF pages to images...")
        pages = convert_from_path(file_path, dpi=300, poppler_path=POPPLER_PATH)
        print(f"PDF has {len(pages)} pages.")

        for i, page in enumerate(pages, start=1):
            print(f"Processing page {i}/{len(pages)}...")
            image_gray = cv2.cvtColor(np.array(page), cv2.COLOR_RGB2GRAY)
            page_text = run_custom_ocr(image_gray, file_path)
            all_text.append(f"--- Page {i} ---\n{page_text}\n")
    else:
        print("Processing image file...")
        image_gray = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
        if image_gray is None:
            print("Error loading the image.")
            sys.exit(1)
        page_text = run_custom_ocr(image_gray, file_path)
        all_text.append(page_text)

    final_text = "\n".join(all_text)

    # Save to PDF
    final_pdf_filename = f"{Path(file_path).stem}_custom_output.pdf"
    save_to_pdf(final_text, final_pdf_filename)
    print(f"Saved the final OCR output to PDF: {final_pdf_filename}")

if __name__ == "__main__":
    import numpy as np
    main()
