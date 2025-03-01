import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center mt-6 lg:mt-16">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-950/60 text-orange-400 border border-orange-800/60 mb-6">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Ensemble OCR (CRNN-CTC, EasyOCR, PaddleOCR, Tesseract) + Gemini LLM</span>
      </div>

      <h1 className="text-4xl sm:text-6xl lg:text-7xl text-center tracking-wide font-extrabold max-w-5xl leading-tight">
        Digitize Degraded Handwritten Documents with{" "}
        <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 text-transparent bg-clip-text">
          Ensemble OCR & LLM
        </span>
      </h1>
      
      <p className="mt-8 text-lg sm:text-xl text-center text-neutral-400 max-w-3xl leading-relaxed">
        An end-to-end framework combining bespoke RCNN-CTC trained on the IAM dataset with EasyOCR, PaddleOCR, and Tesseract, unified via weighted ROVER voting and enhanced with Google Gemini for archival preservation.
      </p>

      <div className="flex flex-wrap justify-center gap-4 my-10">
        <button
          onClick={() => navigate('/ocr')}
          className="bg-gradient-to-r from-orange-500 to-red-700 hover:from-orange-600 hover:to-red-800 py-3.5 px-7 rounded-lg text-white font-medium shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          <span>Open Digitization Studio</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>

        <button
          onClick={() => navigate('/test')}
          className="py-3.5 px-7 rounded-lg border border-neutral-700 hover:border-neutral-500 bg-neutral-900/60 text-neutral-200 font-medium transition-all"
        >
          Live Camera & Single OCR
        </button>

        <button 
          onClick={() => navigate('/poly')}
          className="py-3.5 px-7 rounded-lg border border-orange-900/50 hover:border-orange-700/60 bg-neutral-950 text-neutral-300 font-medium transition-all"
        >
          Automated Form Assistant
        </button>
      </div>
      
      {/* Interactive Architecture Flow Preview (Replaces missing static video) */}
      <div className="w-full max-w-5xl mt-6 p-6 sm:p-8 bg-neutral-900/90 border border-neutral-800 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-sm">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-6 flex items-center justify-between">
          <span>End-to-End Digitization Pipeline</span>
          <span className="text-orange-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> CER 5% | WER 8%</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col">
            <span className="text-orange-500 text-xs font-bold mb-1">STAGE 1</span>
            <h4 className="font-semibold text-white mb-2 text-sm">Preprocessing</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">CLAHE contrast enhancement, Gaussian blur denoising & Otsu binarization.</p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col">
            <span className="text-amber-500 text-xs font-bold mb-1">STAGE 2</span>
            <h4 className="font-semibold text-white mb-2 text-sm">Parallel OCR</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">Custom CRNN-CTC (IAM dataset), EasyOCR, PaddleOCR, and Tesseract in parallel.</p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col">
            <span className="text-red-500 text-xs font-bold mb-1">STAGE 3</span>
            <h4 className="font-semibold text-white mb-2 text-sm">ROVER Ensemble</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">Weighted majority voting alignment resolving character discrepancies.</p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-orange-900/40 bg-gradient-to-b from-orange-950/20 to-neutral-950 flex flex-col">
            <span className="text-orange-400 text-xs font-bold mb-1">STAGE 4</span>
            <h4 className="font-semibold text-white mb-2 text-sm">Gemini LLM Refinement</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">Contextual spelling reconstruction, grammar correction & PDF export.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
