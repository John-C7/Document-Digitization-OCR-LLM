import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import {
  Upload, Camera, RefreshCw, FileText, Download, CheckCircle2,
  AlertCircle, Sparkles, Layers, Sliders, BarChart3, Copy, Check,
  Eye, Zap, FileCode, SplitSquareVertical, ArrowRight, ShieldCheck,
  RotateCw, Compass, BookOpen, Table, FileSpreadsheet
} from 'lucide-react';

const API_BASE = 'http://localhost:5000';

const PRESETS = [
  { id: 'standard', name: 'Standard Document', icon: FileText, desc: 'General cursive & print handwriting with grammatical correction' },
  { id: 'historical', name: 'Historical Manuscript', icon: BookOpen, desc: 'Degraded/aged archival documents; preserves archaic spellings' },
  { id: 'form', name: 'Completed Form', icon: Table, desc: 'Certificates & forms; aligns field labels with handwritten entries' },
  { id: 'tabular', name: 'Tabular Ledger', icon: FileSpreadsheet, desc: 'Extracts tables into structured Markdown rows & columns' }
];

const DigitizationStudio = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [useWebcam, setUseWebcam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Configuration options
  const [enableLLM, setEnableLLM] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('gemini-2.5-flash');
  const [docMode, setDocMode] = useState('standard');
  const [applyDeskew, setApplyDeskew] = useState(true);
  const [applyShadowRemoval, setApplyShadowRemoval] = useState(true);
  const [binarizationMethod, setBinarizationMethod] = useState('otsu');
  const [visionAssisted, setVisionAssisted] = useState(true);
  const [groundTruth, setGroundTruth] = useState('');

  // OCR Weights (ROVER)
  const [weights, setWeights] = useState({
    'Custom CRNN-CTC': 1.25,
    'EasyOCR': 1.0,
    'PaddleOCR': 1.15,
    'Tesseract': 0.85
  });

  // UI State
  const [activeTab, setActiveTab] = useState('enhanced');
  const [activeStage, setActiveStage] = useState('binary');
  const [splitView, setSplitView] = useState(false);
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [samples, setSamples] = useState([]);

  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch bundled sample documents
  useEffect(() => {
    axios.get(`${API_BASE}/api/samples`)
      .then(res => {
        if (res.data.samples) setSamples(res.data.samples);
      })
      .catch(() => {});
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUseWebcam(false);
      setErrorMessage(null);
    }
  };

  const handleSelectSample = async (sampleFilename) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`${API_BASE}/api/samples/${sampleFilename}`);
      const blob = await res.blob();
      const file = new File([blob], sampleFilename, { type: 'image/png' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUseWebcam(false);
    } catch (err) {
      setErrorMessage('Failed to load sample image.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureWebcam = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setPreviewUrl(imageSrc);
      fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], 'webcam_capture.jpg', { type: 'image/jpeg' });
          setSelectedFile(file);
          setUseWebcam(false);
        });
    }
  };

  const handleWeightChange = (model, val) => {
    setWeights((prev) => ({ ...prev, [model]: parseFloat(val) || 1.0 }));
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      setErrorMessage('Please upload, capture, or select a sample handwritten document image first.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('enable_llm', enableLLM ? 'true' : 'false');
    formData.append('model_name', llmModel);
    formData.append('mode', docMode);
    formData.append('apply_deskew', applyDeskew ? 'true' : 'false');
    formData.append('apply_shadow_removal', applyShadowRemoval ? 'true' : 'false');
    formData.append('binarization_method', binarizationMethod);
    formData.append('vision_assisted', visionAssisted ? 'true' : 'false');

    if (geminiApiKey.trim()) formData.append('gemini_api_key', geminiApiKey.trim());
    if (groundTruth.trim()) formData.append('ground_truth', groundTruth.trim());
    formData.append('weights', JSON.stringify(weights));

    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });

      if (response.data.success) {
        setResults(response.data);
        setActiveTab(enableLLM && response.data.llm_enhanced_text ? 'enhanced' : 'ensemble');
      } else {
        setErrorMessage(response.data.error || 'Failed to process document.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.error ||
        'Could not connect to the backend server on http://localhost:5000. Please ensure the Flask backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = (text, filename = 'digitized_output.txt') => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-neutral-800 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-orange-600/20 text-orange-500 border border-orange-500/30 shadow-lg shadow-orange-500/10">
              <Layers className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                Handwritten Document Digitization Studio
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-neutral-400 flex items-center gap-2">
                <span>ROVER Dynamic Sequence Alignment</span>
                <span>•</span>
                <span className="text-orange-400 font-medium">Gemini 2.5 / 2.0 Multimodal Restoration</span>
                <span>•</span>
                <span>4-Model Parallel Ensemble</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSplitView(!splitView)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${
              splitView
                ? 'bg-orange-600/20 text-orange-400 border-orange-500/40'
                : 'text-neutral-400 hover:text-white bg-neutral-900 border-neutral-800'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>{splitView ? 'Exit Split View' : 'Side-by-Side'}</span>
          </button>
          <a
            href="/"
            className="text-xs text-neutral-400 hover:text-white px-3 py-2 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900 transition"
          >
            Home
          </a>
        </div>
      </div>

      {/* Quick Test Samples Bar */}
      <div className="max-w-7xl mx-auto mb-6 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-neutral-400">
          <Zap className="w-4 h-4 text-orange-400" />
          <span className="font-semibold text-neutral-200">Quick Test Samples:</span>
          <span>Click to test instantly without uploading</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {samples.length > 0 ? (
            samples.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSample(s.filename)}
                className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-orange-500/50 text-neutral-300 hover:text-orange-400 font-medium transition"
              >
                {s.title}
              </button>
            ))
          ) : (
            <>
              <button
                onClick={() => handleSelectSample('sample_1.png')}
                className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-orange-500/50 text-neutral-300 font-medium transition"
              >
                Sample 1 (Letter)
              </button>
              <button
                onClick={() => handleSelectSample('sample_2.png')}
                className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-orange-500/50 text-neutral-300 font-medium transition"
              >
                Sample 2 (Degraded Manuscript)
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload, Settings, Configuration (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Document Upload Card */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-orange-400" />
                1. Input Document
              </span>
              {selectedFile && (
                <span className="text-xs font-normal text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Loaded
                </span>
              )}
            </h2>

            {useWebcam ? (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-neutral-700 bg-black aspect-video flex items-center justify-center">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCaptureWebcam}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-xl text-sm transition shadow-lg shadow-orange-600/20"
                  >
                    Capture Frame
                  </button>
                  <button
                    onClick={() => setUseWebcam(false)}
                    className="px-4 border border-neutral-700 hover:bg-neutral-800 text-neutral-300 rounded-xl text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-800 hover:border-orange-500/80 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-neutral-950/60 hover:bg-neutral-900/50 min-h-[170px]"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  {previewUrl ? (
                    <div className="w-full flex flex-col items-center">
                      <img
                        src={previewUrl}
                        alt="Document Preview"
                        className="max-h-52 max-w-full rounded-lg border border-neutral-800 object-contain shadow-md"
                      />
                      <span className="text-xs text-orange-400 mt-2 font-medium">Click to replace file</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-neutral-800/80 text-orange-400 rounded-full mb-3 shadow">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-neutral-200 text-center">
                        Drop handwritten scan or click to browse
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">Supports PNG, JPG, JPEG, TIFF, BMP, PDF</p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <span className="text-xs text-neutral-500">or</span>
                  <button
                    onClick={() => setUseWebcam(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-700 transition"
                  >
                    <Camera className="w-3.5 h-3.5 text-orange-400" />
                    Use Webcam
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Document Preset Selector */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-orange-400" />
              2. Restoration Domain Preset
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {PRESETS.map((p) => {
                const IconComponent = p.icon;
                const isSelected = docMode === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setDocMode(p.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-orange-600/10 border-orange-500 text-white shadow-sm'
                        : 'bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <IconComponent className={`w-4 h-4 ${isSelected ? 'text-orange-400' : 'text-neutral-500'}`} />
                      <span className="font-semibold text-neutral-200">{p.name}</span>
                    </div>
                    <span className="text-[11px] leading-tight text-neutral-500">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Preprocessing & Model Weights Card */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
            <h2 className="text-base font-semibold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-400" />
                3. Preprocessing & ROVER Weights
              </span>
            </h2>

            {/* Preprocessing Toggles */}
            <div className="grid grid-cols-2 gap-3 text-xs border-b border-neutral-800 pb-4">
              <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyDeskew}
                  onChange={(e) => setApplyDeskew(e.target.checked)}
                  className="rounded bg-neutral-800 border-neutral-700 text-orange-600 focus:ring-orange-500"
                />
                <span>Auto-Deskew (Straighten)</span>
              </label>

              <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyShadowRemoval}
                  onChange={(e) => setApplyShadowRemoval(e.target.checked)}
                  className="rounded bg-neutral-800 border-neutral-700 text-orange-600 focus:ring-orange-500"
                />
                <span>Shadow / Vignette Removal</span>
              </label>

              <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visionAssisted}
                  onChange={(e) => setVisionAssisted(e.target.checked)}
                  className="rounded bg-neutral-800 border-neutral-700 text-orange-600 focus:ring-orange-500"
                />
                <span>Multimodal Vision Grounding</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Threshold:</span>
                <select
                  value={binarizationMethod}
                  onChange={(e) => setBinarizationMethod(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-neutral-200 outline-none"
                >
                  <option value="otsu">Otsu</option>
                  <option value="adaptive">Adaptive Sauvola</option>
                </select>
              </div>
            </div>

            {/* Model Weights */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {Object.keys(weights).map((model) => (
                <div key={model} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex justify-between font-medium mb-1">
                    <span className="text-neutral-300 truncate">{model}</span>
                    <span className="text-orange-400 font-bold">{weights[model]}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.05"
                    value={weights[model]}
                    onChange={(e) => handleWeightChange(model, e.target.value)}
                    className="w-full accent-orange-500 h-1 bg-neutral-800 rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Gemini LLM Enhancement Settings */}
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5 cursor-pointer">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  Gemini LLM Enhancement
                </label>
                <input
                  type="checkbox"
                  checked={enableLLM}
                  onChange={(e) => setEnableLLM(e.target.checked)}
                  className="rounded bg-neutral-800 border-neutral-700 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                />
              </div>

              {enableLLM && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Model Version</label>
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 outline-none focus:border-orange-500/80"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Latest & Best)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">API Key (Optional)</label>
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Uses server key if empty"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 placeholder-neutral-600 outline-none focus:border-orange-500/80"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional Ground Truth Benchmarking */}
            <div className="border-t border-neutral-800 pt-4 space-y-2">
              <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-orange-400" />
                Ground Truth for Benchmarking (Optional)
              </label>
              <textarea
                rows={2}
                value={groundTruth}
                onChange={(e) => setGroundTruth(e.target.value)}
                placeholder="Paste authentic ground truth text to measure CER & WER..."
                className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-neutral-200 placeholder-neutral-600 outline-none focus:border-orange-500/80 resize-none font-mono"
              />
            </div>

            {/* Run Button */}
            <button
              onClick={handleProcess}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-xl shadow-orange-600/25 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Ensemble & LLM Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Digitization Pipeline</span>
                </>
              )}
            </button>

            {errorMessage && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Multi-Model Results & Analysis (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl min-h-[640px] flex flex-col">
            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 pb-3 gap-2">
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {enableLLM && results?.llm_enhanced_text && (
                  <button
                    onClick={() => setActiveTab('enhanced')}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      activeTab === 'enhanced'
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    LLM Enhanced
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('ensemble')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'ensemble'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                  }`}
                >
                  ROVER Consensus
                </button>

                {results?.diff && results.diff.length > 0 && (
                  <button
                    onClick={() => setActiveTab('diff')}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                      activeTab === 'diff'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    Word Diff
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('individual')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'individual'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                  }`}
                >
                  4x OCR Models
                </button>

                <button
                  onClick={() => setActiveTab('visual')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                    activeTab === 'visual'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preproc Stages
                </button>

                {results?.benchmarks && Object.keys(results.benchmarks).length > 0 && (
                  <button
                    onClick={() => setActiveTab('benchmarks')}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                      activeTab === 'benchmarks'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                    }`}
                  >
                    CER / WER
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-2">
                {results?.deskew_angle !== undefined && Math.abs(results.deskew_angle) > 0 && (
                  <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                    <RotateCw className="w-3 h-3 text-orange-400" />
                    <span>Deskew: {results.deskew_angle > 0 ? `+${results.deskew_angle}` : results.deskew_angle}°</span>
                  </div>
                )}
                {results?.confidence_score && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Consensus: {results.confidence_score}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 py-4">
              {!results ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
                  <FileText className="w-12 h-12 text-neutral-700 mb-3" />
                  <p className="text-sm font-medium text-neutral-400">Ready to Digitize Document</p>
                  <p className="text-xs text-neutral-600 max-w-sm mt-1">
                    Upload a handwritten scan or select a sample above and run the ensemble pipeline to inspect consensus text, visual stages, and word diffs.
                  </p>
                </div>
              ) : (
                <>
                  {/* Split View (Side-by-Side original image and result) */}
                  {splitView && previewUrl && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                      <div>
                        <span className="text-[11px] font-semibold text-neutral-400 block mb-1.5">Original Handwritten Input</span>
                        <img
                          src={previewUrl}
                          alt="Input Scan"
                          className="max-h-64 w-full object-contain rounded-lg border border-neutral-800 bg-black"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-orange-400 block mb-1.5">
                          {activeTab === 'enhanced' ? 'Restored Text (Gemini LLM)' : 'ROVER Consensus Text'}
                        </span>
                        <div className="max-h-64 overflow-y-auto p-3 bg-neutral-900 rounded-lg text-xs font-mono text-neutral-200 whitespace-pre-wrap">
                          {activeTab === 'enhanced' ? results.llm_enhanced_text : results.ensemble_text}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 1: LLM Enhanced Text */}
                  {activeTab === 'enhanced' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap justify-between items-center text-xs text-neutral-400 gap-2">
                        <span className="text-orange-400 flex items-center gap-1.5 font-medium">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Restored by {results.llm_model_used || 'Gemini 2.5 Flash'} (Mode: {docMode})</span>
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(results.llm_enhanced_text)}
                            className="hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => downloadTextFile(results.llm_enhanced_text, 'digitized_enhanced.txt')}
                            className="hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>TXT</span>
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-neutral-950 border border-orange-900/40 rounded-xl font-mono text-sm leading-relaxed text-neutral-100 whitespace-pre-wrap max-h-[460px] overflow-y-auto bg-gradient-to-b from-orange-950/10 to-neutral-950 shadow-inner">
                        {results.llm_enhanced_text || 'No enhancement returned.'}
                      </div>
                      {results.llm_error && (
                        <p className="text-xs text-amber-400">Notice: {results.llm_error}</p>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ROVER Consensus Ensemble Text */}
                  {activeTab === 'ensemble' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs text-neutral-400">
                        <span>Dynamic sequence alignment consensus across active models:</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(results.ensemble_text)}
                            className="hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => downloadTextFile(results.ensemble_text, 'rover_ensemble.txt')}
                            className="hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>TXT</span>
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap max-h-[460px] overflow-y-auto">
                        {results.ensemble_text || 'No text recognized.'}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Word Diff View */}
                  {activeTab === 'diff' && results.diff && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-neutral-400">
                        <span>Differences between raw ROVER consensus and LLM enhanced text:</span>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Corrected / Restored</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> OCR Error</span>
                        </div>
                      </div>
                      <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-sm leading-relaxed max-h-[460px] overflow-y-auto">
                        {results.diff.map((token, idx) => {
                          if (token.type === 'equal') {
                            return <span key={idx} className="text-neutral-300">{token.text} </span>;
                          } else if (token.type === 'replaced') {
                            return (
                              <span key={idx} className="inline-flex flex-wrap items-center mx-1">
                                <span className="bg-red-950/80 text-red-400 line-through px-1 rounded text-xs">{token.original}</span>
                                <ArrowRight className="w-3 h-3 mx-0.5 text-neutral-500 inline" />
                                <span className="bg-emerald-950/80 text-emerald-300 font-semibold px-1 rounded text-xs">{token.corrected}</span>{' '}
                              </span>
                            );
                          } else if (token.type === 'inserted') {
                            return <span key={idx} className="bg-emerald-950/80 text-emerald-300 px-1 rounded font-medium">{token.text} </span>;
                          } else if (token.type === 'deleted') {
                            return <span key={idx} className="bg-red-950/80 text-red-400 line-through px-1 rounded text-xs">{token.text} </span>;
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: 4x Individual OCR Models */}
                  {activeTab === 'individual' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(results.ocr_outputs || {}).map(([name, text]) => (
                        <div key={name} className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col">
                          <div className="flex justify-between items-center text-xs font-semibold text-neutral-300 pb-2 border-b border-neutral-800/80 mb-2">
                            <span>{name}</span>
                            <span className="text-neutral-500 font-normal">wt: {weights[name]}</span>
                          </div>
                          <div className="text-xs font-mono text-neutral-300 whitespace-pre-wrap max-h-48 overflow-y-auto flex-1">
                            {text || <span className="text-neutral-600 italic">No output produced</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 5: Preprocessing Stages & Visualizations */}
                  {activeTab === 'visual' && (
                    <div className="space-y-4">
                      {results.preprocessing_stages && (
                        <div className="flex gap-2 border-b border-neutral-800 pb-2 text-xs">
                          {['original', 'deskewed', 'shadow_removed', 'binary'].map((stageKey) => (
                            <button
                              key={stageKey}
                              onClick={() => setActiveStage(stageKey)}
                              className={`px-3 py-1 rounded-lg capitalize font-medium transition ${
                                activeStage === stageKey
                                  ? 'bg-neutral-800 text-orange-400 border border-neutral-700'
                                  : 'text-neutral-500 hover:text-neutral-300'
                              }`}
                            >
                              {stageKey.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      )}

                      <div>
                        <h4 className="text-xs font-semibold text-neutral-300 mb-2 capitalize">
                          {activeStage.replace('_', ' ')} Image
                        </h4>
                        {results.preprocessing_stages && results.preprocessing_stages[activeStage] ? (
                          <img
                            src={results.preprocessing_stages[activeStage]}
                            alt={activeStage}
                            className="max-h-72 w-full object-contain rounded-xl border border-neutral-800 bg-black"
                          />
                        ) : (
                          results.preprocessed_image && (
                            <img
                              src={results.preprocessed_image}
                              alt="Binary Preview"
                              className="max-h-72 w-full object-contain rounded-xl border border-neutral-800 bg-black"
                            />
                          )
                        )}
                      </div>

                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-neutral-300 mb-2">
                          CRNN-CTC Word Detections ({results.detected_boxes_count || 0} regions detected)
                        </h4>
                        {results.visualized_image && (
                          <img
                            src={results.visualized_image}
                            alt="Annotated Detections"
                            className="max-h-72 w-full object-contain rounded-xl border border-neutral-800 bg-black"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: Benchmark Metrics */}
                  {activeTab === 'benchmarks' && results.benchmarks && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
                          <span className="text-xs text-neutral-400 block mb-1">Ensemble CER</span>
                          <span className="text-xl font-bold text-orange-400">
                            {((results.benchmarks.ensemble?.cer || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
                          <span className="text-xs text-neutral-400 block mb-1">Ensemble WER</span>
                          <span className="text-xl font-bold text-amber-400">
                            {((results.benchmarks.ensemble?.wer || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
                          <span className="text-xs text-neutral-400 block mb-1">LLM CER Reduction</span>
                          <span className="text-xl font-bold text-emerald-400">
                            {results.benchmarks.enhanced?.cer_improvement || 0}%
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-neutral-300">
                          <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 uppercase">
                            <tr>
                              <th className="py-2.5 px-3">Model</th>
                              <th className="py-2.5 px-3">CER</th>
                              <th className="py-2.5 px-3">WER</th>
                              <th className="py-2.5 px-3">Char Acc</th>
                              <th className="py-2.5 px-3">Word Acc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-800">
                            {Object.entries(results.benchmarks.models || {}).map(([mName, stats]) => (
                              <tr key={mName}>
                                <td className="py-2.5 px-3 font-medium text-white">{mName}</td>
                                <td className="py-2.5 px-3 font-mono">{(stats.cer * 100).toFixed(1)}%</td>
                                <td className="py-2.5 px-3 font-mono">{(stats.wer * 100).toFixed(1)}%</td>
                                <td className="py-2.5 px-3 font-mono">{stats.char_accuracy}%</td>
                                <td className="py-2.5 px-3 font-mono">{stats.word_accuracy}%</td>
                              </tr>
                            ))}
                            {results.benchmarks.ensemble && (
                              <tr className="bg-orange-950/20 font-semibold text-orange-300">
                                <td className="py-2.5 px-3">Ensemble (ROVER)</td>
                                <td className="py-2.5 px-3 font-mono">{(results.benchmarks.ensemble.cer * 100).toFixed(1)}%</td>
                                <td className="py-2.5 px-3 font-mono">{(results.benchmarks.ensemble.wer * 100).toFixed(1)}%</td>
                                <td className="py-2.5 px-3 font-mono">{results.benchmarks.ensemble.char_accuracy}%</td>
                                <td className="py-2.5 px-3 font-mono">{results.benchmarks.ensemble.word_accuracy}%</td>
                              </tr>
                            )}
                            {results.benchmarks.enhanced && (
                              <tr className="bg-emerald-950/20 font-semibold text-emerald-300">
                                <td className="py-2.5 px-3">Ensemble + Gemini LLM</td>
                                <td className="py-2.5 px-3 font-mono">{(results.benchmarks.enhanced.cer * 100).toFixed(1)}%</td>
                                <td className="py-2.5 px-3 font-mono">{(results.benchmarks.enhanced.wer * 100).toFixed(1)}%</td>
                                <td className="py-2.5 px-3 font-mono">{results.benchmarks.enhanced.char_accuracy}%</td>
                                <td className="py-2.5 px-3 font-mono">{results.benchmarks.enhanced.word_accuracy}%</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Actions: Multi-format Export Bar */}
            {results && (
              <div className="border-t border-neutral-800 pt-4 flex flex-wrap justify-between items-center gap-3">
                <span className="text-xs text-neutral-500">
                  Export reconstructed document in multiple formats:
                </span>
                <div className="flex flex-wrap gap-2">
                  {results.pdf_url && (
                    <a
                      href={`${API_BASE}${results.pdf_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-medium px-3.5 py-2 rounded-lg text-xs shadow transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </a>
                  )}
                  {results.md_url && (
                    <a
                      href={`${API_BASE}${results.md_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-medium px-3 py-2 rounded-lg text-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Markdown</span>
                    </a>
                  )}
                  {results.json_url && (
                    <a
                      href={`${API_BASE}${results.json_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-medium px-3 py-2 rounded-lg text-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>JSON</span>
                    </a>
                  )}
                  {results.txt_url && (
                    <a
                      href={`${API_BASE}${results.txt_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 font-medium px-3 py-2 rounded-lg text-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>TXT</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitizationStudio;
