"""
preprocessor.py
Advanced Image Preprocessing Pipeline for Degraded & Handwritten Documents.
Implements:
1. Deskewing & automatic orientation correction
2. Non-uniform background illumination normalization & shadow removal
3. Edge-preserving bilateral filtering
4. Contrast Limited Adaptive Histogram Equalization (CLAHE)
5. Multi-method binarization (Otsu & Adaptive Sauvola/Gaussian)
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
        # File storage object from Flask / WSGI
        file_bytes = np.frombuffer(image_input.read(), np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        image_input.seek(0)

    if img is None:
        raise ValueError("Could not decode image from provided input.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img.copy()
    return img, gray


def deskew_image(gray_img, max_angle=45.0):
    """
    Detects document orientation skew angle and rotates the image to straighten horizontal text lines.
    Returns: deskewed grayscale image, deskew angle in degrees.
    """
    try:
        # Invert colors (text = white, background = black) for contour analysis
        _, thresh = cv2.threshold(gray_img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Morphological dilation to connect characters into horizontal words/lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 5))
        dilated = cv2.dilate(thresh, kernel, iterations=1)

        # Find text block contours
        contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        angles = []
        for c in contours:
            if cv2.contourArea(c) > 500:
                rect = cv2.minAreaRect(c)
                angle = rect[-1]
                # Adjust OpenCV minAreaRect angle convention
                if angle < -45:
                    angle = -(90 + angle)
                elif angle > 45:
                    angle = 90 - angle
                else:
                    angle = -angle
                if abs(angle) <= max_angle:
                    angles.append(angle)

        if not angles:
            return gray_img, 0.0

        median_angle = float(np.median(angles))

        # Rotate only if skew is noticeable (> 0.5 degrees)
        if abs(median_angle) > 0.5:
            (h, w) = gray_img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
            rotated = cv2.warpAffine(
                gray_img, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return rotated, round(median_angle, 2)

        return gray_img, 0.0
    except Exception:
        return gray_img, 0.0


def normalize_illumination(gray_img):
    """
    Removes uneven background shadows and yellowing by estimating the background
    using morphological dilation and dividing the foreground.
    """
    try:
        dilated = cv2.dilate(gray_img, np.ones((7, 7), np.uint8))
        bg_img = cv2.medianBlur(dilated, 21)
        diff_img = 255 - cv2.absdiff(gray_img, bg_img)
        norm_img = cv2.normalize(diff_img, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
        return norm_img
    except Exception:
        return gray_img


def preprocess_for_ocr(
    gray_img,
    apply_deskew=True,
    apply_shadow_removal=True,
    binarization_method="otsu"
):
    """
    Comprehensive multi-stage preprocessing pipeline tailored for handwritten documents.
    Returns:
        dict containing processed images, deskew angle, and base64 previews of each stage.
    """
    deskew_angle = 0.0
    stage_gray = gray_img.copy()

    # Stage 1: Deskewing
    if apply_deskew:
        stage_gray, deskew_angle = deskew_image(stage_gray)
    deskewed_preview = stage_gray.copy()

    # Stage 2: Background Illumination Normalization (Shadow Removal)
    if apply_shadow_removal:
        stage_gray = normalize_illumination(stage_gray)
    shadow_removed_preview = stage_gray.copy()

    # Stage 3: Contrast Enhancement (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    enhanced_gray = clahe.apply(stage_gray)

    # Stage 4: Edge-Preserving Smoothing (Bilateral filter avoids blurring handwritten strokes)
    filtered = cv2.bilateralFilter(enhanced_gray, d=7, sigmaColor=50, sigmaSpace=50)

    # Stage 5: Binarization
    if binarization_method == "adaptive":
        binary = cv2.adaptiveThreshold(
            filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 21, 10
        )
    else:
        # Default: Otsu's optimal global clustering threshold
        _, binary = cv2.threshold(filtered, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return {
        "enhanced_gray": enhanced_gray,
        "binary": binary,
        "deskew_angle": deskew_angle,
        "stages": {
            "original": image_to_base64(gray_img),
            "deskewed": image_to_base64(deskewed_preview),
            "shadow_removed": image_to_base64(shadow_removed_preview),
            "binary": image_to_base64(binary)
        },
        "base64_preview": image_to_base64(binary)
    }


def image_to_base64(img_bgr_or_gray):
    """Encodes an OpenCV image to base64 data URI."""
    if img_bgr_or_gray is None:
        return ""
    success, buffer = cv2.imencode('.png', img_bgr_or_gray)
    if not success:
        return ""
    b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{b64}"
