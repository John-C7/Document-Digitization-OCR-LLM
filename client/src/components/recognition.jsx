import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const OCR = () => {
    const [image, setImage] = useState(null);
    const [ocrResult, setOcrResult] = useState('');
    const [report, setReport] = useState('');
    const [loading, setLoading] = useState(false);
    const webcamRef = useRef(null);

    const captureImage = () => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            setImage(imageSrc);
            sendImageToBackend(dataURItoBlob(imageSrc));
        }
    };

    const uploadImage = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImage(URL.createObjectURL(file));
            sendImageToBackend(file);
        }
    };

    const sendImageToBackend = (file) => {
        setLoading(true);
        setOcrResult('');
        setReport('');

        const formData = new FormData();
        formData.append('image', file);

        axios
            .post('http://localhost:5000/process', formData)
            .then((response) => {
                const extractedText = response.data.ocr_text;
                setOcrResult(extractedText);
                sendToGemini(extractedText);
            })
            .catch((error) => {
                console.error('OCR Processing Failed:', error);
                setOcrResult('Failed to process image.');
                setLoading(false);
            });
    };

    const sendToGemini = (text) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
        if (!apiKey) {
            setReport('Gemini API key not configured. Please configure VITE_GEMINI_API_KEY or use Digitization Studio.');
            setLoading(false);
            return;
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `Improve the following OCR text with grammar corrections and fill in missing context: ${text}`,
                        },
                    ],
                },
            ],
        };

        axios
            .post(apiUrl, requestBody)
            .then((response) => {
                const reportText =
                    response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                    'No response from Gemini.';
                setReport(reportText);
            })
            .catch((error) => {
                console.error('Gemini API Failed:', error);
                setReport('Failed to fetch Gemini report.');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const dataURItoBlob = (dataURI) => {
        const byteString = atob(dataURI.split(',')[1]);
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    };

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-black text-white space-y-6 lg:space-y-0 lg:space-x-6 p-6">
            {/* Left Panel - Webcam & Upload */}
            <div className="flex-1 p-6 bg-[#212121] rounded-lg flex flex-col items-center space-y-4">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full max-w-sm rounded-lg border-2 border-gray-700"
                />
                <button
                    onClick={captureImage}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                    Capture from Webcam
                </button>
                <input
                    type="file"
                    accept="image/*"
                    onChange={uploadImage}
                    className="file:bg-gray-700 file:text-white file:border-none file:py-2 file:px-4 file:rounded-lg cursor-pointer"
                />
                {image && (
                    <img
                        src={image}
                        alt="Captured"
                        className="w-full max-w-xs mt-4 rounded-lg border border-gray-700"
                    />
                )}
            </div>

            {/* Center Panel - OCR Result */}
            <div className="flex-1 p-6 bg-[#212121] rounded-lg overflow-hidden">
                <h2 className="text-xl font-semibold mb-2">OCR Result</h2>
                <div className="bg-gray-800 p-2 rounded h-80 overflow-auto whitespace-pre-wrap">
                    {loading ? 'Processing OCR...' : (ocrResult || 'No OCR result yet')}
                </div>
            </div>

            {/* Right Panel - Gemini Report */}
            <div className="flex-1 p-6 bg-[#212121] rounded-lg overflow-hidden">
                <h2 className="text-xl font-semibold mb-2">Gemini Report</h2>
                <div className="bg-gray-800 p-2 rounded h-80 overflow-auto whitespace-pre-wrap">
                    {loading ? 'Fetching Gemini report...' : (report || 'No report yet')}
                </div>
            </div>
        </div>
    );
};

export default OCR;
