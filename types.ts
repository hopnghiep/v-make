
export interface ImageData {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

export interface AudioData {
  base64: string;
  mimeType: string;
  fileName: string;
}

export interface VideoConfig {
  prompt: string;
  musicStyle: string;
  aspectRatio: 'auto' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
  resolution: '720p' | '1080p';
  voiceoverScript?: string;
  subtitleText?: string;
  audioRef?: AudioData;
  transitionStyle: string;
  duration: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  ANALYZING_AUDIO = 'ANALYZING_AUDIO',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
