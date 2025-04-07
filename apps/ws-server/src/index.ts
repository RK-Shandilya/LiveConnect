import { RawData, WebSocketServer } from "ws";
import { spawnFFmpegContainer } from './docker/ffmpeg-worker';
import { randomUUID } from "crypto";
import NodeMediaServer from "node-media-server"

const wss = new WebSocketServer({port:3001});

const nms = new NodeMediaServer({
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true
  },
  http: {
    port: 8000,
    mediaroot: './media',
    allow_origin: '*',
  },
  auth: {
    api: true,
    api_user: 'admin',
    api_pass: 'admin'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [{
      app: 'live',
      hls: true,
      hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]'
    }]
  }
});

nms.run();

// Add event listeners for better debugging
nms.on('preConnect', (id: string, streamPath: string, args: object) => {
  console.log('[NodeMediaServer] preConnect', id, streamPath, args);
});

nms.on('postConnect', (id: string, streamPath: string, args: object) => {
  console.log('[NodeMediaServer] postConnect', id, args);
});

nms.on('doneConnect', (id: string, streamPath: string, args: object) => {
  console.log('[NodeMediaServer] doneConnect', id, args);
});

nms.on('prePublish', (id, streamPath, args) => {
  console.log('[NodeMediaServer] Stream publishing:', streamPath);
});

nms.on('postPublish', (id, streamPath, args) => {
  console.log('[NodeMediaServer] Stream published:', streamPath);
});

nms.on('donePublish', (id, streamPath, args) => {
  console.log('[NodeMediaServer] Stream ended:', streamPath);
});


wss.on("connection", async (ws) => {
  const streamKey = randomUUID();
  console.log(`New connection for stream ${streamKey}`);

  const { container, ffmpegStream } = await spawnFFmpegContainer(streamKey);

  let bytesReceived = 0;

  ws.on('message', (data: RawData) => {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
    console.log(`Received ${chunk.length} bytes`);
    bytesReceived += chunk.length;
    
    try {
        const writeSuccess = ffmpegStream.write(chunk);
        if (!writeSuccess) {
            console.log("FFmpeg stream buffer full, waiting for drain");
            ffmpegStream.once('drain', () => {
                console.log("FFmpeg stream drained");
            });
        }
    } catch (err) {
        console.error("Error writing to FFmpeg stream:", err);
    }
  });

  ws.on('close', async () => {
      // Wait for queue to drain before closing
      const drainInterval = setInterval(() => {
        clearInterval(drainInterval);
        ffmpegStream.end();
        container.stop().catch(console.error);
        container.remove().catch(console.error);
      }, 100);
  });
});