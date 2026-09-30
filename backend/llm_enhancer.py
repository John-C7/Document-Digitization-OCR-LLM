"""
llm_enhancer.py
State-of-the-Art Large Language Model (LLM) Enhancement Module using Google Gemini.
Supports:
1. Latest models: Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro
2. Multi-modal grounding: Combines visual document image with OCR ensemble hypotheses
3. Domain-tailored system presets: Standard, Historical Manuscript, Govt/Official Forms, Tabular Records
4. Structured entity & metadata extraction
5. Word-level diff computation for interactive comparison
"""

import os
import json
import logging
import requests
import difflib
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

SYSTEM_PRESETS = {
    "standard": """You are an expert handwritten document reconstruction assistant.
You are given digitized text obtained from an OCR ensemble applied to handwritten records.
Your task:
1. Correct OCR spelling errors and character misrecognitions using surrounding syntactic context.
2. Logically restore fragmented or worn words without fabricating factual content.
3. Fix punctuation and paragraph flow while faithfully preserving the original meaning.
4. Return ONLY the polished, restored document text.
""",

    "historical": """You are a paleographer and historical manuscript preservation specialist.
You are given OCR outputs of degraded, aged historical handwritten manuscripts.
Your task:
1. Repair optical degradation, ink bleed-through errors, and faded handwriting strokes.
2. Respect historical/archaic vocabulary and spellings where intentional.
3. Reconstruct missing sentence fragments conservatively based on historical style.
4. Output the restored text cleanly with preserved line structures.
""",

    "form": """You are an intelligent document and form processing system for administrative and legal records.
You are given raw OCR text from a completed handwritten form or certificate.
Your task:
1. Clean up noisy handwritten responses.
2. Align field labels with their corresponding handwritten values (e.g. Name: [value], Date: [value]).
3. Format output in cleanly structured, easy-to-read sections.
""",

    "tabular": """You are a tabular data extraction assistant for handwritten ledgers and rosters.
Your task:
1. Parse the OCR ensemble output into a clean Markdown table with appropriate column headers.
2. Correct numbers, dates, and column entries using tabular context.
3. Preserve row alignment and table integrity.
"""
}


def compute_text_diff(original_text: str, enhanced_text: str) -> List[Dict[str, Any]]:
    """
    Computes word-level diff between raw ensemble text and LLM enhanced text.
    Returns list of tokens tagged as 'equal', 'inserted', 'deleted', or 'replaced'.
    """
    orig_words = original_text.split()
    enh_words = enhanced_text.split()

    matcher = difflib.SequenceMatcher(None, orig_words, enh_words)
    diff_tokens = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            diff_tokens.append({
                "type": "equal",
                "text": " ".join(orig_words[i1:i2])
            })
        elif tag == 'replace':
            diff_tokens.append({
                "type": "replaced",
                "original": " ".join(orig_words[i1:i2]),
                "corrected": " ".join(enh_words[j1:j2])
            })
        elif tag == 'delete':
            diff_tokens.append({
                "type": "deleted",
                "text": " ".join(orig_words[i1:i2])
            })
        elif tag == 'insert':
            diff_tokens.append({
                "type": "inserted",
                "text": " ".join(enh_words[j1:j2])
            })

    return diff_tokens


def enhance_with_gemini(
    input_text: str,
    api_key: str = None,
    model_name: str = "gemini-2.5-flash",
    mode: str = "standard",
    image_base64: Optional[str] = None
) -> Dict[str, Any]:
    """
    Enhances OCR ensemble text via Google Gemini API with fallback across model generations.
    Optionally accepts image_base64 for multimodal visual grounding.
    """
    if not input_text or not input_text.strip():
        return {
            "success": False,
            "enhanced_text": input_text,
            "error": "Empty input text.",
            "diff": []
        }

    resolved_key = (
        api_key
        or os.getenv("GEMINI_API_KEY")
        or None
    )

    if not resolved_key or "YOUR_GEMINI" in resolved_key:
        logger.warning("No valid Gemini API key supplied.")
        return {
            "success": False,
            "enhanced_text": input_text,
            "error": "No Gemini API key configured. Provide an API key in the studio settings or set GEMINI_API_KEY in the environment.",
            "diff": []
        }

    # Model hierarchy: try requested, then 2.5-flash, 2.0-flash, 1.5-flash, 1.5-pro
    hierarchy = [model_name, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    models_to_try = []
    for m in hierarchy:
        if m and m not in models_to_try:
            models_to_try.append(m)

    system_instruction = SYSTEM_PRESETS.get(mode, SYSTEM_PRESETS["standard"])

    # Construct request parts (supporting multimodal if image provided)
    parts = []
    if image_base64 and "," in image_base64:
        try:
            mime_type = image_base64.split(";")[0].split(":")[1]
            b64_data = image_base64.split(",")[1]
            parts.append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": b64_data
                }
            })
            prompt_intro = "Examine the attached handwritten document image and the raw OCR ensemble text below. Use visual clues from the image to resolve uncertain words and correct spelling:"
        except Exception:
            prompt_intro = "Here is the raw OCR ensemble text to correct:"
    else:
        prompt_intro = "Here is the raw OCR ensemble text to correct:"

    parts.append({
        "text": f"{system_instruction}\n\n{prompt_intro}\n---\n{input_text}\n---"
    })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 4096
        }
    }
    headers = {"Content-Type": "application/json"}

    last_error = None
    for target_model in models_to_try:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={resolved_key}"
        try:
            response = requests.post(endpoint, headers=headers, json=payload, timeout=25)
            if response.status_code == 200:
                data = response.json()
                enhanced = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                diff_data = compute_text_diff(input_text, enhanced)
                return {
                    "success": True,
                    "enhanced_text": enhanced,
                    "model_used": target_model,
                    "diff": diff_data,
                    "error": None
                }
            else:
                last_error = f"HTTP {response.status_code} ({target_model}): {response.text[:200]}"
                logger.warning(f"Gemini API returned: {last_error}")
        except Exception as ex:
            last_error = f"{type(ex).__name__} on {target_model}: {str(ex)}"
            logger.warning(f"Connection error to {target_model}: {ex}")

    return {
        "success": False,
        "enhanced_text": input_text,
        "error": last_error,
        "diff": []
    }
