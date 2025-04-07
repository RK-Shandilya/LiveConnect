import Docker from 'dockerode';

const docker = new Docker();

export async function spawnFFmpegContainer(streamKey: string) {
    try {
        console.log(`Setting up FFmpeg container for stream key: ${streamKey}`);
        
        await new Promise((resolve, reject) => {
            docker.pull('jrottenberg/ffmpeg:4.1-alpine', (err: Error, stream: NodeJS.ReadableStream) => {
                if (err) return reject(err);
                
                docker.modem.followProgress(stream, (err: Error | null, result: any[]) => {
                    err ? reject(err) : resolve(null);
                });
            });
        });

        const container = await docker.createContainer({
            Image: 'jrottenberg/ffmpeg:4.1-alpine',
            Cmd: [
                "-flags:v", "+global_header",
                "-re",
                "-f", "webm",
                "-i", "pipe:0",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-profile:v", "baseline",
                "-x264-params", "keyint=30:min-keyint=30", // Reduce keyframe interval
                "-bufsize", "1000k",
                "-maxrate", "600k", // Reduce output bitrate
                "-g", "30",
                "-c:a", "aac",
                "-ac", "2",
                "-ar", "44100",
                "-f", "flv",
                `rtmp://host.docker.internal:1935/live/test`
            ],
            AttachStdin: true,
            OpenStdin: true,
            StdinOnce: false,
            Tty: false,
            HostConfig: {
                NetworkMode: "host",
            }
        });

        await container.start();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`FFmpeg container started for stream key: ${streamKey}`);

        const stream = await container.attach({
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true,
            hijack: true
        });

        // Log container output for debugging
        container.logs({
            follow: true,
            stdout: true,
            stderr: true
        }, (err, stream) => {
            if (err) {
                console.error(`Error getting logs: ${err.message}`);
                return;
            }
            stream?.on('data', (chunk) => {
                console.log(`[FFmpeg ${streamKey}]: ${chunk.toString()}`);
            });

            stream?.on('error', (err) => {
                console.error(`[FFmpeg Error] ${err}`);
            });
            
            stream?.on('end', () => {
                console.log('[FFmpeg] Stream ended');
            });
        });

        return {
            container,
            ffmpegStream: stream,
            streamKey
        };
    } catch (error) {
        console.error('Failed to spawn FFmpeg container:', error);
        throw error;
    }
}