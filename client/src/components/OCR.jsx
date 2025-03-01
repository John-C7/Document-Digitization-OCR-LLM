import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';
import axios from 'axios';

const OCR1 = () => {
    const [image, setImage] = useState(null);
    const [ocrResult, setOcrResult] = useState('');
    const [report, setReport] = useState('');
    const webcamRef = useRef(null);

    const captureImage = () => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImage(imageSrc);
        performOCR(imageSrc);
    };

    const uploadImage = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            setImage(reader.result);
            performOCR(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const performOCR = (img) => {
        Tesseract.recognize(
            img,
            'eng',
            {
                logger: (m) => console.log(m),
            }
        ).then(({ data: { text } }) => {
            setOcrResult(text);
            sendToGemini(text);
        });
    };

    const sendToGemini = (text) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
        if (!apiKey) {
            setReport('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your environment or use the Digitization Studio.');
            return;
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `Give the processed ${text} in a well formatted way and add proper grammar and missing context to the text`,
                        },
                    ],
                },
            ],
        };

        axios.post(apiUrl, requestBody)
            .then((response) => {
                const reportData = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No data received.';
                setReport(reportData);
            })
            .catch((error) => {
                console.error('Error:', error.response?.data || error.message || error);
                setReport('Failed to fetch Gemini report. Please try again later.');
            });
    };

    return (
        <div className="flex h-screen bg-black text-white space-x-6 p-6">
            {/* Left Column: Webcam and File Upload */}
            <div className="flex-1 p-6 bg-[#212121] rounded-lg shadow-lg flex flex-col items-center justify-center">
                <h2 className="text-2xl font-semibold mb-4">Capture or Upload Image</h2>
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full max-w-sm rounded-lg mb-4"
                />
                <button
                    onClick={captureImage}
                    className="bg-gray-600 text-white py-2 px-6 rounded-lg hover:bg-gray-700 mb-4"
                >
                    Capture from Webcam
                </button>
                <input
                    type="file"
                    accept="image/*"
                    onChange={uploadImage}
                    className="block w-full text-gray-800"
                />
            </div>

            {/* Middle Column: OCR Result */}
            <div className="flex-1 p-6 bg-[#212121] rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold mb-4 text-center">OCR Result</h2>
                <div className="h-full flex flex-col justify-center items-center">
                    {image && <img src={image} alt="Captured" className="w-full max-w-sm rounded-lg mb-4" />}
                    {ocrResult ? (
                        <pre className="text-lg bg-gray-800 p-4 rounded-lg overflow-auto max-h-96">
                            {ocrResult}
                        </pre>
                    ) : (
                        <p className="text-lg">Waiting for OCR result...</p>
                    )}
                </div>
            </div>

            {/* Right Column: Gemini Report */}
            <div className="flex-1 p-6 bg-[#212121] rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold mb-4 text-center">Gemini Report</h2>
                <div className="h-full flex flex-col justify-center items-center">
                    {report ? (
                        <div
                            className="text-lg bg-gray-800 p-4 rounded-lg overflow-y-auto max-h-96 w-full"
                            style={{
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                            }}
                        >
                            {report}
                        </div>
                    ) : (
                        <p className="text-lg">Waiting for Gemini report...</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OCR1;
