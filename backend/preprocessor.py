"""
preprocessor.py
Image Preprocessing Pipeline for Degraded Handwritten Documents.
Implements grayscale conversion, Gaussian filtering, contrast enhancement,
and Otsu's adaptive binarization as described in the implementation paper.
"""

import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image


def load_image(image_input):
    """
    Loads an image from a file path, file-like object, or numpy array.
    Returns: BGR numpy image and grayscale numpy image.
    """
    if isinstance(image_input, np.ndarray):
        img = image_input
    elif isinstance(image_input, (str, bytes)):
        if isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            img = cv2.imread(image_input)
    else:
        # File storage object from Flask
        file_bytes = np.frombuffer(image_input.read(), np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        image_input.seek(0)

    if img is None:
        raise ValueError("Could not decode image.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img.copy()
    return img, gray


def preprocess_for_ocr(gray_img):
    """
    Applies noise reduction, CLAHE contrast enhancement, and Otsu binarization.
    Returns:
        dict containing processed images (grayscale_enhanced, binary, and base64 preview)
    """
    # 1. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_gray = clahe.apply(gray_img)

    # 2. Gaussian Blurring to smooth out handwriting grain and paper artifacts
    blurred = cv2.GaussianBlur(enhanced_gray, (5, 5), 0)

    # 3. Otsu's Automated Thresholding for optimal foreground-background separation
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Convert binary to base64 for UI preview
    _, buffer = cv2.imencode('.png', binary)
    b64_binary = base64.b64encode(buffer).decode('utf-8')

    return {
        "enhanced_gray": enhanced_gray,
        "binary": binary,
        "base64_preview": f"data:image/png;base64,{b64_binary}"
    }


def image_to_base64(img_bgr_or_gray):
    """Encodes an OpenCV image to base64 data URI."""
    _, buffer = cv2.imencode('.png', img_bgr_or_gray)
    b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{b64}"
