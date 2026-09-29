# Changelog

All notable changes to the **Document Digitization OCR-LLM** system are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-09-30

### 🚀 Major Enhancements & Upgraded Algorithms

#### 1. Advanced Computer Vision Preprocessing (`backend/preprocessor.py`)
- **Automated Document Deskewing**:
  - Implemented contour minimum area bounding rectangle and morphological text orientation detection to automatically correct document skew (±45° range).
- **Background Illumination Normalization & Shadow Removal**:
  - Added background illumination approximation using morphological dilation and adaptive difference normalization to eliminate harsh shadows from camera captures and degraded yellowed papers.
- **Edge-Preserving Bilateral Smoothing**:
  - Upgraded smoothing filter from naive Gaussian blur to bilateral filtering (`d=7`, `sigmaColor=50`, `sigmaSpace=50`), maintaining razor-sharp handwriting stroke edges while eliminating paper grain.
- **Multi-Method Binarization**:
  - Added support for both Otsu's global clustering threshold and Gaussian Adaptive thresholding (Sauvola-style) for uneven ink density.
- **Multi-Stage Visual Previews**:
  - Pipeline now returns base64 previews of all transformation stages: Original, Deskewed, Shadow-Removed, and Binarized.

#### 2. ROVER Dynamic Sequence Alignment Consensus (`backend/ensemble_engine.py`)
- **Needleman-Wunsch Global Word Sequence Alignment**:
  - Replaced naive string padding (`.ljust()`) with dynamic programming sequence alignment across all model hypotheses with insertion/deletion gap tracking (`<null>` / `ε`).
- **Word Transition Network (WTN) Voting**:
  - Built slot-level voting with model-specific confidence weighting (`Custom CRNN-CTC: 1.25`, `PaddleOCR: 1.15`, `EasyOCR: 1.0`, `Tesseract: 0.85`).
- **Lexicon-Assisted Consensus**:
  - Integrated 370k-word English dictionary lookup bonus for candidate resolution.
- **Character Confusion Resolution**:
  - Added character-level discrepancy voting within aligned word slots for subtle OCR typos.
- **Per-Line & Per-Word Confidence Scoring**:
  - Returns detailed alignment metadata, consensus ratio, and high-confidence ratios.

#### 3. State-of-the-Art Gemini Multimodal LLM Enhancement (`backend/llm_enhancer.py`)
- **Latest Model Support**:
  - Added full support for **Gemini 2.5 Flash** (default), **Gemini 2.0 Flash**, **Gemini 1.5 Flash**, and **Gemini 1.5 Pro** with automated fallbacks.
- **Multimodal Visual Grounding**:
  - When enabled, passes the document image alongside the OCR ensemble hypotheses so Gemini can visually inspect degraded strokes for ambiguous words.
- **Domain-Tailored Restoration Presets**:
  - Added 4 specialized domain prompts:
    1. *Standard Document*: General handwriting & grammatical recovery.
    2. *Historical Manuscript*: Paleographic restoration preserving archaic terminology.
    3. *Completed Form*: Administrative records aligning labels with handwritten entries.
    4. *Tabular Ledger*: Structured table and columnar data formatting.
- **Interactive Word Diff Engine**:
  - Implemented `difflib` sequence matching returning structured word insertions, deletions, and corrections between raw OCR consensus and LLM-enhanced text.

#### 4. Frontend & User Interface Revamp (`client/`)
- **Quick Test Sample Document Selector**:
  - One-click load for bundled test manuscripts (`sample_1.png`, `sample_2.png`, `sample_2_line.png`).
- **Side-by-Side Split View**:
  - Added toggleable split screen comparing original document scan directly against restored text.
- **Interactive Word Diff Viewer**:
  - Visual badges highlighting words restored/corrected by the LLM vs raw OCR errors.
- **Multi-Stage Image Inspector**:
  - Interactive tabs switching between Original, Deskewed, Shadow-Removed, Binarized, and Bounding Box Word Detections.
- **Multi-Format Export**:
  - Instant export to PDF, Markdown (`.md`), JSON, and Plain Text (`.txt`).
- **Modernized Responsive Design**:
  - High-tech dark mode palette, smooth Tailwind transitions, and updated typography.

#### 5. Security & Secret Remediation
- **Complete Secret Elimination**:
  - Fully removed all hardcoded API keys from frontend and backend components.
  - Standardized on `GEMINI_API_KEY` (backend environment) and `VITE_GEMINI_API_KEY` (frontend environment / runtime UI entry).

---

## [1.0.0] - 2025-03-01

### Initial Release
- **Ensemble Architecture**:
  - Custom CRNN-CTC model trained on the IAM Handwriting Database.
  - Multi-OCR runner integrating EasyOCR, PaddleOCR, and Tesseract.
- **Baseline ROVER Voting**:
  - Character-level majority voting across models.
- **Gemini LLM Integration**:
  - Contextual post-processing with Google Gemini Pro.
- **Evaluation & Benchmarking**:
  - Levenshtein-based Word Error Rate (WER) and Character Error Rate (CER) calculation.
- **PDF Generation**:
  - Multi-page report generation using ReportLab.
- **Web Interface**:
  - Initial React + Vite client with webcam capture, form assistant (Poly), and landing page.
