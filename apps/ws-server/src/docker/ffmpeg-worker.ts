import Docker from 'dockerode';

const docker = new Docker();

export async function spawnFFmpegContainer(streamKey: string) {
    try {
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
            ExposedPorts: {
                '5732/tcp': {}
            },
            Cmd: [
                "-i", "-",                 
                "-c:v", "libx264",         
                "-preset", "veryfast",    
                "-tune", "zerolatency",   
                "-f", "flv",              
                `rtmp://127.0.0.1:5732/live/${streamKey}`
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

        const stream = await container.attach({
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true
        });

        return {
            container,
            ffmpegStream: stream
        };
    } catch (error) {
        console.log('Failed to spawn FFmpeg container:', error);
        throw error;
    }
}