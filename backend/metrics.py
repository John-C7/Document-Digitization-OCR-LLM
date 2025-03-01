"""
metrics.py
Benchmarking and Accuracy Evaluation Utilities.
Computes Character Error Rate (CER), Word Error Rate (WER),
and Accuracy metrics relative to reference Ground Truth.
"""

from typing import Dict, Any, List
import numpy as np


def compute_edit_distance(ref_tokens: List[str], hyp_tokens: List[str]) -> int:
    """Computes Levenshtein edit distance between token sequences."""
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
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # deletion
                dp[i][j - 1] + 1,       # insertion
                dp[i - 1][j - 1] + cost # substitution
            )
    return int(dp[n][m])


def word_error_rate(reference: str, hypothesis: str) -> float:
    """Computes Word Error Rate (WER)."""
    ref_words = reference.split()
    hyp_words = hypothesis.split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    dist = compute_edit_distance(ref_words, hyp_words)
    return round(dist / len(ref_words), 4)


def char_error_rate(reference: str, hypothesis: str) -> float:
    """Computes Character Error Rate (CER)."""
    ref_chars = list(reference)
    hyp_chars = list(hypothesis)
    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0
    dist = compute_edit_distance(ref_chars, hyp_chars)
    return round(dist / len(ref_chars), 4)


def compute_benchmarks(
    ground_truth: str,
    ocr_outputs: Dict[str, str],
    ensemble_text: str,
    enhanced_text: str = None
) -> Dict[str, Any]:
    """
    Evaluates all individual models, the ensemble, and the LLM-enhanced result
    against ground truth text.
    """
    results = {
        "models": {},
        "ensemble": {},
        "enhanced": {}
    }

    gt_clean = ground_truth.strip()
    if not gt_clean:
        return results

    # Evaluate each individual model
    for model_name, text in ocr_outputs.items():
        wer = word_error_rate(gt_clean, text)
        cer = char_error_rate(gt_clean, text)
        results["models"][model_name] = {
            "wer": wer,
            "cer": cer,
            "word_accuracy": round(max(0.0, (1.0 - wer) * 100.0), 2),
            "char_accuracy": round(max(0.0, (1.0 - cer) * 100.0), 2)
        }

    # Evaluate pre-LLM ensemble
    ens_wer = word_error_rate(gt_clean, ensemble_text)
    ens_cer = char_error_rate(gt_clean, ensemble_text)
    results["ensemble"] = {
        "wer": ens_wer,
        "cer": ens_cer,
        "word_accuracy": round(max(0.0, (1.0 - ens_wer) * 100.0), 2),
        "char_accuracy": round(max(0.0, (1.0 - ens_cer) * 100.0), 2)
    }

    # Evaluate post-LLM enhanced text
    if enhanced_text:
        enh_wer = word_error_rate(gt_clean, enhanced_text)
        enh_cer = char_error_rate(gt_clean, enhanced_text)
        results["enhanced"] = {
            "wer": enh_wer,
            "cer": enh_cer,
            "word_accuracy": round(max(0.0, (1.0 - enh_wer) * 100.0), 2),
            "char_accuracy": round(max(0.0, (1.0 - enh_cer) * 100.0), 2),
            "wer_improvement": round(max(0.0, (ens_wer - enh_wer) / (ens_wer + 1e-6) * 100.0), 1),
            "cer_improvement": round(max(0.0, (ens_cer - enh_cer) / (ens_cer + 1e-6) * 100.0), 1)
        }

    return results
