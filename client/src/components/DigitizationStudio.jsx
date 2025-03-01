import React, { useState, useRef } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import {
  Upload, Camera, RefreshCw, FileText, Download, CheckCircle,
  AlertCircle, Sparkles, Layers, Sliders, BarChart3, Copy, Check
} from 'lucide-react';

const API_BASE = 'http://localhost:5000';

const DigitizationStudio = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [useWebcam, setUseWebcam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Configuration options
  const [enableLLM, setEnableLLM] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [groundTruth, setGroundTruth] = useState('');
  const [weights, setWeights] = useState({
    'Custom CRNN-CTC': 1.2,
    'EasyOCR': 1.0,
    'PaddleOCR': 1.1,
    'Tesseract': 0.8
  });
  const [activeTab, setActiveTab] = useState('ensemble');

  // Response data
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUseWebcam(false);
      setErrorMessage(null);
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
      setErrorMessage('Please upload or capture a handwritten document image first.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('enable_llm', enableLLM ? 'true' : 'false');
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
            <span className="p-2 rounded-lg bg-orange-600/20 text-orange-500 border border-orange-500/30">
              <Layers className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Handwritten Document Digitization Studio
            </h1>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Ensemble OCR (RCNN-CTC + EasyOCR + PaddleOCR + Tesseract) with Gemini LLM Post-Processing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-md border border-neutral-800 hover:border-neutral-700 transition"
          >
            Back to Home
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload, Settings, Configuration (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Document Upload Card */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-orange-400" />
              1. Input Document
            </h2>

            {useWebcam ? (
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden border border-neutral-700 bg-black aspect-video flex items-center justify-center">
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
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg text-sm transition"
                  >
                    Capture Frame
                  </button>
                  <button
                    onClick={() => setUseWebcam(false)}
                    className="px-4 border border-neutral-700 hover:bg-neutral-800 text-neutral-300 rounded-lg text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-700 hover:border-orange-500/80 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-neutral-950/40 hover:bg-neutral-900/60 min-h-[160px]"
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
                        className="max-h-48 max-w-full rounded border border-neutral-800 object-contain shadow-md"
                      />
                      <span className="text-xs text-orange-400 mt-2 font-medium">Click to replace file</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-neutral-800 text-orange-400 rounded-full mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-neutral-200 text-center">
                        Drop handwritten scan or click to browse
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">Supports PNG, JPG, JPEG, TIFF, BMP</p>
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

          {/* Model Weights & Pipeline Controls Card */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 shadow-xl space-y-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-400" />
              2. OCR Ensemble Weights (ROVER)
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {Object.keys(weights).map((model) => (
                <div key={model} className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800">
                  <div className="flex justify-between font-medium mb-1">
                    <span className="text-neutral-300 truncate">{model}</span>
                    <span className="text-orange-400 font-bold">{weights[model]}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
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
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Gemini API Key (optional, uses server default)"
                  className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 placeholder-neutral-600 outline-none focus:border-orange-500/80"
                />
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
                className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 placeholder-neutral-600 outline-none focus:border-orange-500/80 resize-none font-mono"
              />
            </div>

            {/* Process Button */}
            <button
              onClick={handleProcess}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 disabled:opacity-50"
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
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Multi-Model Results & Analysis (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 shadow-xl min-h-[600px] flex flex-col">
            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 pb-3 gap-2">
              <div className="flex flex-wrap gap-1 sm:gap-2">
                <button
                  onClick={() => setActiveTab('ensemble')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'ensemble'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                  }`}
                >
                  Consensus Ensemble
                </button>

                {enableLLM && results?.llm_enhanced_text && (
                  <button
                    onClick={() => setActiveTab('enhanced')}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
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
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    activeTab === 'visual'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800'
                  }`}
                >
                  Detections & Preprocessing
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
                    CER / WER Metrics
                  </button>
                )}
              </div>

              {/* Confidence Score Pill */}
              {results?.confidence_score && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Consensus: {results.confidence_score}%</span>
                </div>
              )}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 py-4">
              {!results ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
                  <FileText className="w-12 h-12 text-neutral-700 mb-3" />
                  <p className="text-sm font-medium text-neutral-400">Ready to Digitize Document</p>
                  <p className="text-xs text-neutral-600 max-w-sm mt-1">
                    Upload a handwritten scan on the left and run the ensemble pipeline to view extracted text, visualizations, and metrics.
                  </p>
                </div>
              ) : (
                <>
                  {/* TAB 1: Consensus Ensemble Text */}
                  {activeTab === 'ensemble' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs text-neutral-400">
                        <span>Multi-model consensus via ROVER weighted voting:</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(results.ensemble_text)}
                            className="hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-neutral-950 border border-neutral-800"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => downloadTextFile(results.ensemble_text, 'ensemble_ocr.txt')}
                            className="hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-neutral-950 border border-neutral-800"
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

                  {/* TAB 2: LLM Enhanced Text */}
                  {activeTab === 'enhanced' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs text-neutral-400">
                        <span className="text-orange-400 flex items-center gap-1 font-medium">
                          <Sparkles className="w-3.5 h-3.5" />
                          Contextually reconstructed & spell-corrected by Gemini:
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(results.llm_enhanced_text)}
                            className="hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-neutral-950 border border-neutral-800"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => downloadTextFile(results.llm_enhanced_text, 'enhanced_digitized.txt')}
                            className="hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-neutral-950 border border-neutral-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>TXT</span>
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-neutral-950 border border-orange-900/40 rounded-xl font-mono text-sm leading-relaxed text-neutral-100 whitespace-pre-wrap max-h-[460px] overflow-y-auto bg-gradient-to-b from-orange-950/10 to-neutral-950">
                        {results.llm_enhanced_text || 'No enhancement returned.'}
                      </div>
                      {results.llm_error && (
                        <p className="text-xs text-amber-400">Notice: {results.llm_error}</p>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Individual OCR Models Side-by-Side */}
                  {activeTab === 'individual' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(results.ocr_outputs || {}).map(([name, text]) => (
                        <div key={name} className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex flex-col">
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

                  {/* TAB 4: Visualizations */}
                  {activeTab === 'visual' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-300 mb-2">
                          Word Bounding Boxes (Custom Detector: {results.detected_boxes_count || 0} detections)
                        </h4>
                        {results.visualized_image && (
                          <img
                            src={results.visualized_image}
                            alt="Annotated Detections"
                            className="max-h-72 w-full object-contain rounded-lg border border-neutral-800 bg-black"
                          />
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-neutral-300 mb-2">
                          Preprocessed Document (Gaussian Blur + Otsu Thresholding)
                        </h4>
                        {results.preprocessed_image && (
                          <img
                            src={results.preprocessed_image}
                            alt="Preprocessed Binary"
                            className="max-h-72 w-full object-contain rounded-lg border border-neutral-800 bg-black"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: Benchmark Evaluation (CER / WER) */}
                  {activeTab === 'benchmarks' && results.benchmarks && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-center">
                          <span className="text-xs text-neutral-400 block mb-1">Ensemble CER</span>
                          <span className="text-xl font-bold text-orange-400">
                            {((results.benchmarks.ensemble?.cer || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-center">
                          <span className="text-xs text-neutral-400 block mb-1">Ensemble WER</span>
                          <span className="text-xl font-bold text-amber-400">
                            {((results.benchmarks.ensemble?.wer || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-center">
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
                              <th className="py-2 px-3">Model</th>
                              <th className="py-2 px-3">CER</th>
                              <th className="py-2 px-3">WER</th>
                              <th className="py-2 px-3">Char Acc</th>
                              <th className="py-2 px-3">Word Acc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-800">
                            {Object.entries(results.benchmarks.models || {}).map(([mName, stats]) => (
                              <tr key={mName}>
                                <td className="py-2 px-3 font-medium text-white">{mName}</td>
                                <td className="py-2 px-3 font-mono">{(stats.cer * 100).toFixed(1)}%</td>
                                <td className="py-2 px-3 font-mono">{(stats.wer * 100).toFixed(1)}%</td>
                                <td className="py-2 px-3 font-mono">{stats.char_accuracy}%</td>
                                <td className="py-2 px-3 font-mono">{stats.word_accuracy}%</td>
                              </tr>
                            ))}
                            {results.benchmarks.ensemble && (
                              <tr className="bg-orange-950/20 font-semibold text-orange-300">
                                <td className="py-2 px-3">Ensemble (ROVER)</td>
                                <td className="py-2 px-3 font-mono">{(results.benchmarks.ensemble.cer * 100).toFixed(1)}%</td>
                                <td className="py-2 px-3 font-mono">{(results.benchmarks.ensemble.wer * 100).toFixed(1)}%</td>
                                <td className="py-2 px-3 font-mono">{results.benchmarks.ensemble.char_accuracy}%</td>
                                <td className="py-2 px-3 font-mono">{results.benchmarks.ensemble.word_accuracy}%</td>
                              </tr>
                            )}
                            {results.benchmarks.enhanced && (
                              <tr className="bg-emerald-950/20 font-semibold text-emerald-300">
                                <td className="py-2 px-3">Ensemble + Gemini LLM</td>
                                <td className="py-2 px-3 font-mono">{(results.benchmarks.enhanced.cer * 100).toFixed(1)}%</td>
                                <td className="py-2 px-3 font-mono">{(results.benchmarks.enhanced.wer * 100).toFixed(1)}%</td>
                                <td className="py-2 px-3 font-mono">{results.benchmarks.enhanced.char_accuracy}%</td>
                                <td className="py-2 px-3 font-mono">{results.benchmarks.enhanced.word_accuracy}%</td>
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

            {/* Bottom Actions: Export to PDF */}
            {results && (
              <div className="border-t border-neutral-800 pt-4 flex flex-wrap justify-between items-center gap-3">
                <span className="text-xs text-neutral-500">
                  Digitization complete • Export polished multi-page report
                </span>
                {results.pdf_url && (
                  <a
                    href={`${API_BASE}${results.pdf_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-medium px-4 py-2 rounded-lg text-xs shadow-md transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Digitized PDF</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitizationStudio;
