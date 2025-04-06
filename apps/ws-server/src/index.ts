import { WebSocketServer } from "ws";
import { spawnFFmpegContainer } from './docker/ffmpeg-worker';
import { randomUUID } from "crypto";

const wss = new WebSocketServer({port:3001});

wss.on("connection", async(ws)=>{
    const streamKey = "test";
    console.log("WS Server is running");

    const { container, ffmpegStream } = await spawnFFmpegContainer(streamKey);
    console.log(container, ffmpegStream);
    ws.on('message', (data: import('ws').RawData) => {
        if (ffmpegStream && typeof ffmpegStream.write === 'function') {
          if (Buffer.isBuffer(data)) {
            ffmpegStream.write(data);
          } else {
            ffmpegStream.write(data.toString());
          }
        }
    });
    ws.on('close', async () => {
        console.log('[WS] Client disconnected');
        ffmpegStream.end();
        await container.stop();
        await container.remove();
    });
})