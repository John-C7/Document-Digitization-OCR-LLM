# Document Digitization OCR-LLM

> **Handwritten Document Digitization System** — an Ensemble OCR pipeline with LLM contextual post-processing, built as part of a published research project.

---

## 📄 Publications & Research Papers

1. **Research Paper**:
   - **Title**: *Comprehensive Study on Digitization of Handwritten Documents using OCR and LLM*
   - **Journal**: Journal of Open Source Software and Technology (JOITS), MAT Journals
   - **Publication Link**: [matjournals.net/engineering/index.php/JOITS/article/view/1367](https://matjournals.net/engineering/index.php/JOITS/article/view/1367)

2. **Implementation Paper**:
   - **Title**: *Implementation of a Handwritten Document Digitization System Using Ensemble OCR and LLM Enhancement*
   - **Conference / Proceedings**: DigitalXplore Proceedings
   - **Proceedings Link**: [digitalxplore.org/proceeding.php?pid=3076](https://digitalxplore.org/proceeding.php?pid=3076)
   - **Abstract**: [digitalxplore.org/abstract.php?pdf_id=11461#intro](https://digitalxplore.org/abstract.php?pdf_id=11461#intro)

---

## 🧠 System Architecture (v2.0)

```
Handwritten Image Input
        │
        ▼
  ┌────────────────────────────────────────────────────────┐
  │         Advanced Preprocessor Pipeline                 │
  │  • Auto-Deskewing (Orientation Contour Rect ±45°)      │
  │  • Background Illumination Normalization (Shadows)     │
  │  • Edge-Preserving Bilateral Smoothing                 │
  │  • Contrast Limited Adaptive Hist Equalization (CLAHE) │
  │  • Multi-mode Binarization (Otsu / Adaptive Sauvola)   │
  └────────────────────────────────────────────────────────┘
        │
        ▼
  ┌────────────────────────────────────────────────────────┐
  │             Ensemble OCR Layer (Parallel)              │
  │  ┌────────────────────────┐  ┌──────────────────────┐  │
  │  │    Custom CRNN-CTC     │  │       EasyOCR        │  │
  │  │(IAM dataset, wt: 1.25) │  │     (weight 1.0)     │  │
  │  └────────────────────────┘  └──────────────────────┘  │
  │  ┌────────────────────────┐  ┌──────────────────────┐  │
  │  │       PaddleOCR        │  │      Tesseract       │  │
  │  │     (weight 1.15)      │  │    (weight 0.85)     │  │
  │  └────────────────────────┘  └──────────────────────┘  │
  └────────────────────────────────────────────────────────┘
        │
        ▼
  ┌────────────────────────────────────────────────────────┐
  │       ROVER Dynamic Sequence Alignment Engine          │
  │  • Needleman-Wunsch Global Word Sequence Alignment     │
  │  • Word Transition Network (WTN) Slot Voting           │
  │  • 370k Lexicon Assistance & Character Resolution      │
  └────────────────────────────────────────────────────────┘
        │
        ▼  Consensus Hypotheses + Image Base64
  ┌────────────────────────────────────────────────────────┐
  │      Gemini 2.5 Multimodal Restoration Engine          │
  │  • Vision-Language Grounding on Raw Handwriting Strokes│
  │  • Domain Presets: Standard, Historical, Forms, Tables │
  │  • Word-Level Diff Generator & Spell Correction        │
  └────────────────────────────────────────────────────────┘
        │
        ▼
  ┌────────────────────────────────────────────────────────┐
  │         Multi-Format Structured Export                 │
  │  • Downloadable Multi-Page PDF Report (ReportLab)      │
  │  • Clean Markdown (.md) with Form/Table Layouts        │
  │  • Structured JSON (.json) with Diff & Word Metadata   │
  │  • Plain Text (.txt) & Interactive Studio Diff View    │
  └────────────────────────────────────────────────────────┘
```

---

## 🗂 Project Structure

```
Document-Digitization-OCR-LLM/
│
├── backend/                    # Flask REST API server
│   ├── app.py                  # Main API server (POST /upload, GET /api/download)
│   ├── ensemble_engine.py      # ROVER weighted voting ensemble logic
│   ├── llm_enhancer.py         # Gemini LLM contextual text enhancement
│   ├── preprocessor.py         # Image loading, Otsu thresholding, base64 utils
│   ├── metrics.py              # WER, CER, Character/Word Accuracy evaluation
│   ├── pdf_generator.py        # Multi-page PDF output generation (ReportLab)
│   └── requirements.txt        # Python dependencies
│
├── client/                     # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── DigitizationStudio.jsx  # Main OCR UI with 5-tab results view
│   │   │   ├── Home.jsx                # Landing page
│   │   │   ├── HeroSection.jsx         # Hero with CTA buttons
│   │   │   ├── FeatureSection.jsx      # Feature cards
│   │   │   ├── Navbar.jsx              # Navigation bar
│   │   │   ├── Poly.jsx                # Voice-driven form-filling assistant
│   │   │   ├── OCR.jsx                 # Simple single-model OCR (Tesseract.js)
│   │   │   ├── recognition.jsx         # Live webcam OCR → backend pipeline
│   │   │   ├── MappingPage.jsx         # WebSocket live video feed overlay
│   │   │   ├── Pricing.jsx, Footer.jsx, Testimonials.jsx
│   │   ├── constants/index.jsx         # Nav items, features, testimonials
│   │   ├── App.jsx                     # React Router routes
│   │   └── main.jsx                    # Root render entry point
│   ├── index.html
│   └── package.json
│
├── HTRPipeline/                # Custom CRNN-CTC handwriting recognition module
│   ├── htr_pipeline/           # Core Python package
│   │   ├── __init__.py         # read_page(), DetectorConfig, ReaderConfig
│   │   ├── reader/             # CTC decoder (best_path / word beam search)
│   │   └── word_detector/      # AABB word-region detector
│   ├── scripts/
│   │   ├── pipeline.py         # Standalone CLI: Custom OCR + Tesseract + Gemini
│   │   ├── ensemble.py         # Standalone CLI: Full 4-model ensemble + Gemini
│   │   └── ocr.py              # Batch PDF/image OCR with PaddleOCR
│   └── data/
│       ├── config.json         # Per-image scale/margin tuning
│       └── words_alpha.txt     # English word list for prefix-tree beam search
│
├── models/                     # Pretrained ONNX model weights
│   ├── detector.onnx           # Word-region segmentation detector
│   ├── reader.onnx             # CRNN-CTC character recognition model
│   ├── reader.json             # Character set vocabulary mapping
│   └── rcnn_train.py           # IAM dataset training script (PyTorch)
│
├── data/                       # Sample test images and config
└── .gitignore
```

---

## 🚀 Quickstart

### Backend (Flask API)

```bash
# Install dependencies (Python 3.9+)
pip install -r backend/requirements.txt

# Also install the local HTR pipeline package
pip install -e HTRPipeline/

# Start the server
python backend/app.py
# Server runs at http://localhost:5000
```

> **Tesseract**: Install [Tesseract-OCR](https://github.com/tesseract-ocr/tesseract) and update the path in `backend/app.py` if needed.  
> **PaddleOCR**: May require `paddlepaddle` GPU version for faster inference.

### Frontend (React + Vite)

```bash
cd client
npm install
npm run dev
# Opens at http://localhost:5173
```

### Standalone CLI Scripts

```bash
# Run ensemble pipeline on a single image
cd HTRPipeline/scripts
python ensemble.py          # Full 4-model ensemble + Gemini

# Run simple custom OCR only
python pipeline.py          # Custom CRNN-CTC + Tesseract + Gemini

# Batch process PDFs/images with PaddleOCR
python ocr.py
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for LLM enhancement |

The frontend `DigitizationStudio` component also accepts the key directly in the UI settings panel.

---

## 📊 Model Performance (IAM Dataset)

| Model | CER | WER | Character Accuracy |
|---|---|---|---|
| Tesseract OCR | 18.4% | 31.2% | 81.6% |
| EasyOCR | 14.7% | 26.8% | 85.3% |
| PaddleOCR | 12.9% | 23.4% | 87.1% |
| Custom CRNN-CTC | 11.2% | 19.8% | 88.8% |
| **Ensemble (ROVER)** | **8.6%** | **15.3%** | **91.4%** |
| **Ensemble + Gemini LLM** | **5.1%** | **9.7%** | **94.9%** |

---

## 🛠 Tech Stack

**Backend**: Python, Flask, OpenCV, pytesseract, EasyOCR, PaddleOCR, ONNX Runtime, ReportLab, Google Gemini API  
**Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Axios, react-webcam  
**ML Models**: Custom CRNN-CTC (trained on IAM Handwriting DB), ONNX-exported word detector

---

## 👥 Authors

- **John Charles J T** — [GitHub](https://github.com/John-C7)
- Akhil Pendyala
- Alan Albuquerque
- Chathur BR
- Priya Nandihal

---

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.