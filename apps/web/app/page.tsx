"use client";
import React, { useEffect, useRef, useState } from 'react';

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    ws.onopen = () => {
      console.log('WebSocket connected ✅');
      setSocket(ws);
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => {
      ws.close();
    };
  }, []);

  const CHUNK_SIZE = 65536;

  const startStream = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video:true,
        audio:true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const mediaRecorder = new MediaRecorder(mediaStream);
      
      let buffer = new Uint8Array(0);
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socket?.readyState === WebSocket.OPEN) {
          const chunk = await event.data.arrayBuffer();
          const chunkArray = new Uint8Array(chunk);
          
          // Append to our existing buffer
          const newBuffer = new Uint8Array(buffer.length + chunkArray.length);
          newBuffer.set(buffer);
          newBuffer.set(chunkArray, buffer.length);
          buffer = newBuffer;
          
          // Send chunks of CHUNK_SIZE
          while (buffer.length >= CHUNK_SIZE) {
            const chunkToSend = buffer.slice(0, CHUNK_SIZE);
            socket.send(chunkToSend);
            buffer = buffer.slice(CHUNK_SIZE);
          }
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;

      setIsStreaming(true);
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  const stopStream = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());

    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }

    setIsStreaming(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">🎥 StreamYard Clone</h1>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full max-w-2xl border border-white rounded-lg shadow-lg"
      />

      <div className="mt-6 space-x-4">
        {!isStreaming ? (
          <button
            onClick={startStream}
            className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded font-semibold"
          >
            Start Stream
          </button>
        ) : (
          <button
            onClick={stopStream}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded font-semibold"
          >
            Stop Stream
          </button>
        )}
      </div>
    </div>
  );
};

export default App;