import React, { useEffect, useRef } from 'react';

function MappingPage() {
  const liveVideoRef = useRef(null); 
  const processedCanvasRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    socketRef.current = new WebSocket('ws://192.168.77.121:8001/ws/video/');

    socketRef.current.onmessage = (event) => {
      const blob = new Blob([event.data], { type: 'image/jpeg' });
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      img.onload = () => {
        const ctx = processedCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, processedCanvasRef.current.width, processedCanvasRef.current.height);
        ctx.drawImage(img, 0, 0, processedCanvasRef.current.width, processedCanvasRef.current.height);
      };
    };

    socketRef.current.onopen = () => console.log("WebSocket connection established");
    socketRef.current.onclose = () => console.log("WebSocket connection closed");

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      liveVideoRef.current.srcObject = stream;
      captureAndSendFrame();
    });

    const captureAndSendFrame = () => {
      const video = liveVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450;
      const ctx = canvas.getContext('2d');

      const processFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Send current frame to the backend as JPEG binary data
          canvas.toBlob((blob) => {
            blob.arrayBuffer().then((buffer) => {
              socketRef.current.send(buffer);
            });
          }, 'image/jpeg');

          requestAnimationFrame(processFrame);
        }
      };
      
      requestAnimationFrame(processFrame);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex h-screen">
      {/* Left Side: Live Video Feed */}
      <div className="w-1/2 flex flex-col items-center justify-center p-4 bg-gray-100">
        <h2 className="text-lg font-bold mb-4">Live Webcam Feed</h2>
        <video
          ref={liveVideoRef}
          className="rounded-lg"
          width="800"
          height="450"
          autoPlay
          muted
        />
      </div>

      {/* Right Side: Processed Mapping Video */}
      <div className="w-1/2 flex flex-col items-center justify-center p-4 bg-gray-200">
        <h2 className="text-lg font-bold mb-4">Processed Mapping Video</h2>
        <canvas
          ref={processedCanvasRef}
          width="800"
          height="450"
          className="border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}

export default MappingPage;
