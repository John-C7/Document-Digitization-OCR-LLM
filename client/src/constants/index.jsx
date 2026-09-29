import { Cpu, Sparkles, Layers, Sliders, FileText, CheckCircle2, RotateCw } from "lucide-react";
import user1 from "../assets/profile-pictures/user1.jpg";
import user2 from "../assets/profile-pictures/user2.jpg";
import user3 from "../assets/profile-pictures/user3.jpg";

export const navItems = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Benchmarking", href: "#benchmarking" },
];

export const features = [
  {
    icon: <Layers className="w-5 h-5 text-orange-400" />,
    text: "ROVER Multi-Model Ensemble",
    description:
      "Dynamically aligns character and word hypotheses across Custom CRNN-CTC, EasyOCR, PaddleOCR, and Tesseract using weighted consensus voting.",
  },
  {
    icon: <Sparkles className="w-5 h-5 text-orange-400" />,
    text: "Gemini 2.5 Multimodal Restoration",
    description:
      "Leverages state-of-the-art vision-language modeling to visually ground handwriting strokes, restoring missing syllables and repairing OCR mistakes.",
  },
  {
    icon: <RotateCw className="w-5 h-5 text-orange-400" />,
    text: "Advanced CV Preprocessing",
    description:
      "Includes automated document deskewing, non-uniform background illumination normalization, bilateral edge-preserving filtering, and adaptive binarization.",
  },
  {
    icon: <FileText className="w-5 h-5 text-orange-400" />,
    text: "Multi-Format Structured Export",
    description:
      "Export restored archival documents to styled multi-page PDF reports, clean Markdown tables, JSON metadata payloads, or plain text.",
  },
];

export const testimonials = [
  {
    user: "Archival Preservation Reviewer",
    company: "Historical Manuscripts Initiative",
    image: user1,
    text: "The ROVER consensus combined with Gemini multimodal restoration recovered 95% of severely faded cursive passages where single OCR models failed completely.",
  },
  {
    user: "Document Intelligence Engineer",
    company: "Govt Records Digitization",
    image: user2,
    text: "Being able to toggle deskewing, illumination normalization, and inspect word diffs side-by-side makes auditing digitized records remarkably efficient.",
  },
  {
    user: "Academic Researcher",
    company: "ICWITE Conference",
    image: user3,
    text: "The system delivers outstanding empirical benchmark results (CER 5.1%, WER 9.7%) on the IAM Handwriting Database with full reproducibility.",
  },
];

export const pricingOptions = [
  {
    title: "Community",
    price: "Free",
    features: [
      "Open Source Core",
      "4-Model Parallel Ensemble",
      "Standard Preprocessing (Otsu)",
      "Single Document Export",
    ],
  },
  {
    title: "Research Studio",
    price: "Standard",
    features: [
      "Gemini 2.5 Flash Enhancement",
      "Auto-Deskew & Shadow Removal",
      "Interactive Word Diff Viewer",
      "Multi-page PDF & Markdown Export",
    ],
  },
  {
    title: "Archival Enterprise",
    price: "Pro",
    features: [
      "Gemini 1.5 Pro Deep Paleography",
      "Batch Image & Multi-page PDF Processing",
      "Automated Form-Filling Assistant (Poly)",
      "Full API & Custom Vocabulary Beam Search",
    ],
  },
];

export const resourcesLinks = [
  { href: "https://matjournals.net/engineering/index.php/JOITS/article/view/1367", text: "Research Paper (JOITS MAT Journals)" },
  { href: "https://digitalxplore.org/proceeding.php?pid=3076", text: "Implementation Paper (DigitalXplore)" },
  { href: "https://github.com/John-C7/Document-Digitization-OCR-LLM", text: "GitHub Repository" },
];
