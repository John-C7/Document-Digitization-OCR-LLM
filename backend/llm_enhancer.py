"""
llm_enhancer.py
Large Language Model (LLM) Enhancement Module using Google Gemini.
Performs contextual text reconstruction, spelling correction, and grammatical
refinement on degraded handwritten OCR ensemble output.
"""

import os
import json
import logging
import requests
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Default system prompt formulated from research paper Section II & V
SYSTEM_INSTRUCTION = """You are an expert handwritten document reconstruction assistant.
You are given digitized text obtained from an OCR ensemble applied to degraded/historical manuscripts.
The raw text may contain:
1. Optical recognition spelling errors and character substitutions.
2. Missing or fragmented words caused by document aging and stroke wear.
3. Grammar and punctuation inconsistencies.

Your task:
- Correct all spelling mistakes using surrounding context.
- Logically reconstruct missing words without fabricating factual content.
- Ensure the output is natural, grammatically coherent, and matches original layout.
- Return ONLY the corrected, polished text without meta comments.
"""


def enhance_with_gemini(
    input_text: str,
    api_key: str = None,
    model_name: str = "gemini-1.5-flash"
) -> Dict[str, Any]:
    """
    Sends ensemble text to the Google Gemini API for contextual error correction.
    
    Args:
        input_text: The OCR ensemble text to enhance.
        api_key: Optional Gemini API key; falls back to GEMINI_API_KEY environment variable.
        model_name: Model version to use ('gemini-1.5-flash' or 'gemini-pro').
        
    Returns:
        dict: {"success": bool, "enhanced_text": str, "error": str or None}
    """
    if not input_text or not input_text.strip():
        return {"success": False, "enhanced_text": input_text, "error": "Empty input text."}

    resolved_key = (
        api_key
        or os.getenv("GEMINI_API_KEY")
        or None
    )

    if not resolved_key or "YOUR_GEMINI" in resolved_key:
        logger.warning("No valid Gemini API key supplied. Skipping LLM enhancement.")
        return {
            "success": False,
            "enhanced_text": input_text,
            "error": "No valid Gemini API key configured."
        }

    # Try newer v1beta models endpoint (gemini-1.5-flash) first, fallback to gemini-pro
    models_to_try = [model_name]
    if model_name != "gemini-1.5-flash":
        models_to_try.append("gemini-1.5-flash")
    if "gemini-pro" not in models_to_try:
        models_to_try.append("gemini-pro")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{SYSTEM_INSTRUCTION}\n\nHere is the raw OCR text:\n---\n{input_text}\n---"
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048
        }
    }
    headers = {"Content-Type": "application/json"}

    last_error = None
    for target_model in models_to_try:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={resolved_key}"
        try:
            response = requests.post(endpoint, headers=headers, json=payload, timeout=20)
            if response.status_code == 200:
                data = response.json()
                enhanced = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return {"success": True, "enhanced_text": enhanced, "error": None}
            else:
                last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                logger.warning(f"Gemini API returned error on {target_model}: {last_error}")
        except Exception as ex:
            last_error = str(ex)
            logger.warning(f"Exception connecting to Gemini ({target_model}): {ex}")

    return {
        "success": False,
        "enhanced_text": input_text,
        "error": last_error
    }
