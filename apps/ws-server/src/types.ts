export interface StreamInitPayload {
    streamKey: string,
    userId: string,
    streamToYouTube?: boolean;
    streamToPlatform?: boolean;
}

export interface TranscodeJob {
    streamKey: string;
    userId: string;
    inputPath: string;
    streamToYouTube?: boolean;
    streamToPlatform?: boolean;
  }