import React, { useState, useEffect } from 'react';
import { Send, XCircle, Paperclip, Mic } from 'lucide-react';
import axios from 'axios';

const Poly = () => {
  const [messagesBot1, setMessagesBot1] = useState([]);
  const [messagesBot2, setMessagesBot2] = useState([]);
  const [output, setOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputValueBot2, setInputValueBot2] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [selectedForm, setSelectedForm] = useState('');
  const [formParameters, setFormParameters] = useState([]); // Store parameters from form
  const [currentParameterIndex, setCurrentParameterIndex] = useState(0); // Track current parameter
  const [responses, setResponses] = useState({}); // Store user responses for parameters

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US'; // Set the language
      synth.speak(utterance);
    } else {
      console.error('Text-to-Speech not supported in this browser.');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
  
      setIsProcessing(true);
      try {
        const { data } = await axios.post('http://192.168.137.46:8000/Vision/generate-text/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        const textOutput = data.text || 'No text returned from backend';
        setMessagesBot1((prev) => [...prev, { sender: 'bot', text: textOutput }]);
        speak(textOutput);
      } catch (error) {
        console.error('Error uploading file:', error);
        setMessagesBot1((prev) => [...prev, { sender: 'bot', text: 'Error uploading file' }]);
      } finally {
        setIsProcessing(false);
      }
    }
  };  

  const handleBot1Input = async (e) => {
    if (e.key === 'Enter' && inputValue.trim() !== '' && !isProcessing) {
      const message = inputValue;
      console.log('Bot 1 Input:', message);
      setMessagesBot1([...messagesBot1, { text: message, sender: 'user' }]);
      setInputValue('');
      setIsProcessing(true);

      setTimeout(() => {
        const botResponse = 'Bot 1 response to: ' + message;
        setMessagesBot1((prev) => [...prev, { text: botResponse, sender: 'bot' }]);
        setOutput(botResponse);
        setIsProcessing(false);
      }, 1000);
    }
  };

  useEffect(() => {
    if (formParameters.length > 0 && currentParameterIndex < formParameters.length) {
      const parameter = formParameters[currentParameterIndex];
      speak(`Please provide the value for ${parameter}`);
      setMessagesBot2((prev) => [
        ...prev,
        { text: `Please provide the value for ${parameter}`, sender: 'bot' },
      ]);
    }
  }, [currentParameterIndex, formParameters]);
  
  // Handle user input for Chatbot 2
  const handleBot2Input = async (e) => {
    if (e.key === 'Enter' && inputValueBot2.trim() !== '' && !isProcessing) {
      const message = inputValueBot2;
      const currentParameter = formParameters[currentParameterIndex];
      console.log(`Bot 2 Input for ${currentParameter}: ${message}`);
  
      // Save user response
      setResponses((prev) => ({
        ...prev,
        [currentParameter]: message,
      }));
  
      setMessagesBot2((prev) => [
        ...prev,
        { text: `Value for ${currentParameter}: ${message}`, sender: 'user' },
      ]);
  
      setInputValueBot2('');
  
      // Move to the next parameter
      if (currentParameterIndex + 1 < formParameters.length) {
        setCurrentParameterIndex((prevIndex) => prevIndex + 1);
      } else {
        // All parameters collected
        setMessagesBot2((prev) => [
          ...prev,
          { text: 'Thank you! All parameters have been collected.', sender: 'bot' },
        ]);
        speak('Thank you! All parameters have been collected.');
  
        // Trigger POST request to backend
        setIsProcessing(true);
        try {
          const response = await axios.post(
            `http://192.168.137.46:8000/Vision/${selectedForm}/`, // Update with your backend endpoint
            responses,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
          console.log('Form submission response:', response.data);
          setMessagesBot2((prev) => [
            ...prev,
            { text: 'Form successfully submitted to the backend!', sender: 'bot' },
          ]);
          speak('Form successfully submitted to the backend!');
        } catch (error) {
          console.error('Error submitting form:', error);
          setMessagesBot2((prev) => [
            ...prev,
            { text: 'Error submitting form. Please try again later.', sender: 'bot' },
          ]);
          speak('Error submitting form. Please try again later.');
        } finally {
          setIsProcessing(false);
        }
      }
    }
  };

  const startVoiceInput = () => {
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = false;
      recognition.interimResults = false;
  
      recognition.onstart = () => {
        setIsListening(true);
      };
  
      recognition.onresult = (event) => {
        const voiceTranscript = event.results[0][0].transcript;
        console.log('Voice Input:', voiceTranscript);
        setVoiceInput(voiceTranscript);
        setIsListening(false);
  
        // If Bot 2 is waiting for input
        if (formParameters.length > 0 && currentParameterIndex < formParameters.length) {
          const currentParameter = formParameters[currentParameterIndex];
  
          // Save the response and move to the next parameter
          setResponses((prev) => ({
            ...prev,
            [currentParameter]: voiceTranscript,
          }));
  
          setMessagesBot2((prev) => [
            ...prev,
            { text: `Value for ${currentParameter}: ${voiceTranscript}`, sender: 'user' },
          ]);
  
          // Move to the next parameter or finalize
          if (currentParameterIndex + 1 < formParameters.length) {
            setCurrentParameterIndex((prevIndex) => prevIndex + 1);
          } else {
            setMessagesBot2((prev) => [
              ...prev,
              { text: 'Thank you! All parameters have been collected.', sender: 'bot' },
            ]);
            speak('Thank you! All parameters have been collected.');
            submitForm(); // Function to submit the form to backend
          }
        }
      };
  
      recognition.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        setIsListening(false);
      };
  
      recognition.onend = () => {
        setIsListening(false);
      };
  
      recognition.start();
    } else {
      alert("Speech recognition is not supported in your browser.");
    }
  };
  
  const submitForm = async () => {
    try {
      setIsProcessing(true);
      const response = await axios.post(
        `http://192.168.137.46:8000/Vision/${selectedForm}/`,
        responses,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      console.log('Form submission response:', response.data);
      setMessagesBot2((prev) => [
        ...prev,
        { text: 'Form successfully submitted to the backend!', sender: 'bot' },
      ]);
    } catch (error) {
      console.error('Error submitting form:', error);
      setMessagesBot2((prev) => [
        ...prev,
        { text: 'Error submitting form. Please try again later.', sender: 'bot' },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };
  

  useEffect(() => {
    if (selectedForm) {
      setIsProcessing(true);
      axios
        .get(`http://192.168.137.46:8000/Vision/${selectedForm}/`)
        .then((response) => {
          console.log('Fetched data:', response.data);
  
          // Extract keys of the form data
          const formDataKeys = Object.keys(response.data);

          setFormParameters(formDataKeys);
          setCurrentParameterIndex(0);
          // Add only keys to Chatbot 1 messages
          setMessagesBot1((prev) => [
            ...prev,
            { sender: 'bot', text: `Form Parameters: ${formDataKeys.join(', ')}` },
          ]);
        })
        .catch((error) => {
          console.error('Error fetching form data:', error);
          setMessagesBot1((prev) => [
            ...prev,
            { sender: 'bot', text: 'Error fetching form data' },
          ]);
        })
        .finally(() => {
          setIsProcessing(false);
        });
    }
  }, [selectedForm]);

  const handleFormSelection = (event) => {
    setSelectedForm(event.target.value);
    const formMessage = `You selected ${event.target.value}. How can I assist you further with this form?`;
    setMessagesBot1([...messagesBot1, { text: formMessage, sender: 'bot' }]);
    setOutput(formMessage);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 p-4">
      <div className="flex flex-col w-1/2 bg-gray-800 rounded-lg p-4 m-2">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Chatbot 1</h2>
        <div className="flex-grow overflow-y-auto mb-4 space-y-2">
            {messagesBot1.map((msg, index) => (
                <div
                key={index}
                className={`p-2 rounded-md my-1 ${
                    msg.sender === 'user' ? 'bg-gray-700 text-white' : 'bg-gray-600 text-gray-200'
                }`}
                >
                {msg.text.includes('Form Parameters') ? (
                    <div>
                    <h3 className="text-orange-400 font-bold mb-1">Form Parameters:</h3>
                    <ul className="list-disc list-inside space-y-1">
                        {msg.text
                        .replace('Form Parameters: ', '')
                        .split(', ')
                        .map((param, idx) => (
                            <li key={idx} className="text-gray-300">
                            {param}
                            </li>
                        ))}
                    </ul>
                    </div>
                ) : (
                    msg.text
                )}
                </div>
            ))}
        </div>

        <div className="mb-4">
          <select
            value={selectedForm}
            onChange={handleFormSelection}
            className="bg-gray-700 rounded-md p-2 text-gray-200 outline-none"
          >
            <option value="">Select Form</option>
            <option value="FORM60">Form 60</option>
            <option value="FORM61">Form 61</option>
            <option value="FORM16H">Form 16H</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="file"
            id="fileUpload"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label htmlFor="fileUpload">
            <Paperclip size={20} className="text-gray-500" />
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleBot1Input}
            disabled={isProcessing}
            className="bg-gray-700 rounded-md p-2 placeholder-gray-400 text-gray-200 outline-none flex-grow"
            placeholder="Type a message..."
          />
          <button
            onClick={handleBot1Input}
            disabled={isProcessing}
            className="text-orange-500 p-2 rounded-md"
          >
            {isProcessing ? (
              <XCircle size={20} className="text-red-600" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col w-1/2 bg-gray-800 rounded-lg p-4 m-2">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Chatbot 2</h2>
        <div className="flex-grow overflow-y-auto mb-4">
          {messagesBot2.map((msg, index) => (
            <div
              key={index}
              className={`p-2 rounded-md my-1 ${
                msg.sender === 'user' ? 'bg-gray-700' : 'bg-gray-600'
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <div className="flex items-center space-x-2">
        <button
            onClick={startVoiceInput}
            disabled={isListening}
            className={`text-orange-500 p-2 rounded-md ${isListening ? 'animate-pulse' : ''}`}
        >
            <Mic size={20} />
        </button>
          <input
            type="text"
            value={inputValueBot2}
            onChange={(e) => setInputValueBot2(e.target.value)}
            onKeyDown={handleBot2Input}
            disabled={isProcessing || isListening}
            className="bg-gray-700 rounded-md p-2 placeholder-gray-400 text-gray-200 outline-none flex-grow"
            placeholder="Type a message..."
          />
          <button
            onClick={handleBot2Input}
            disabled={isProcessing}
            className="text-orange-500 p-2 rounded-md"
          >
            {isProcessing ? (
              <XCircle size={20} className="text-red-600" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Poly;