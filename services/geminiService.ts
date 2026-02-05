
import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";
import { ImageData, VideoConfig } from "../types";

export class VideoService {
  private static async getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private static async analyzeAudio(audio: { base64: string, mimeType: string }): Promise<string> {
    const ai = await this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: audio.base64, mimeType: audio.mimeType } },
            { text: "Describe the mood, instruments, and style of this audio in detail for a video generation prompt. If there is a voice, describe the tone and content." }
          ]
        }
      ]
    });
    return response.text || "";
  }

  static async enhancePrompt(prompt: string, images: ImageData[]): Promise<string> {
    const ai = await this.getAI();
    // AI có thể xử lý tất cả 5 ảnh để hiểu bối cảnh tốt nhất
    const parts: any[] = [{ text: `Act as a cinematic director. Enhance the following video generation prompt to be more descriptive, detailed, and visually stunning for an AI video model (Veo). Keep the core intent but add details about lighting, camera movement, and atmosphere. Original prompt: "${prompt}"` }];
    
    if (images.length > 0) {
      images.forEach(img => {
        parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
      });
      parts.push({ text: "Also consider the visual elements from these reference images to make the prompt consistent." });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts }]
    });
    return response.text?.trim() || prompt;
  }

  static async generateScript(prompt: string): Promise<string> {
    const ai = await this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ 
        role: 'user', 
        parts: [{ text: `Write a short, engaging, and poetic voiceover script (about 20-40 words) for a video with the following theme: "${prompt}". The language should be Vietnamese.` }] 
      }]
    });
    return response.text?.trim() || "";
  }

  static async generateVideo(
    images: ImageData[],
    config: VideoConfig,
    onProgress: (status: string) => void
  ): Promise<string> {
    const ai = await this.getAI();
    
    let audioDescription = config.musicStyle;
    if (config.audioRef) {
      onProgress("Đang phân tích âm thanh bạn cung cấp...");
      audioDescription = await this.analyzeAudio(config.audioRef);
    }

    // Ánh xạ tỷ lệ khung hình về 16:9 hoặc 9:16 cho API Veo
    const apiAspectRatio: '16:9' | '9:16' = config.aspectRatio === '9:16' || config.aspectRatio === '3:4' ? '9:16' : '16:9';
    
    let finalPrompt = `${config.prompt}. `;
    finalPrompt += `Desired visual style: ${config.aspectRatio} aspect ratio content. `;
    
    if (images.length > 1) {
      finalPrompt += `Create a cinematic sequence using the reference images. Use ${config.transitionStyle} transitions. `;
    }

    if (audioDescription) finalPrompt += `Audio style: ${audioDescription}. `;
    if (config.voiceoverScript) finalPrompt += `Voiceover: "${config.voiceoverScript}". `;
    if (config.subtitleText) finalPrompt += `Subtitles: "${config.subtitleText}". `;

    try {
      onProgress("Khởi tạo tiến trình tạo video gốc (Bước 1/2)...");
      
      // API Veo hỗ trợ tối đa 3 referenceImages. 
      // Chúng ta sẽ lấy 3 ảnh đầu tiên để làm tham chiếu kỹ thuật (ASSET).
      const referenceImagesPayload = images.slice(0, 3).map(img => ({
        image: { imageBytes: img.base64, mimeType: img.mimeType },
        referenceType: VideoGenerationReferenceType.ASSET,
      }));

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: finalPrompt,
        config: {
          numberOfVideos: 1,
          referenceImages: referenceImagesPayload,
          resolution: '720p',
          aspectRatio: apiAspectRatio,
        }
      });

      while (!operation.done) {
        onProgress("AI đang render 5 giây đầu tiên...");
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      // Nếu người dùng yêu cầu > 5 giây, thực hiện Extension (Bước 2)
      if (config.duration > 5) {
        const remainingSeconds = config.duration - 5;
        onProgress(`Đang mở rộng video thêm ${remainingSeconds}s (Bước 2/2)...`);
        
        let extendOperation = await ai.models.generateVideos({
          model: 'veo-3.1-generate-preview',
          prompt: `Continue the previous scene naturally for another ${remainingSeconds} seconds, maintaining the same atmosphere and lighting. ${finalPrompt}`,
          video: operation.response?.generatedVideos?.[0]?.video,
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: apiAspectRatio,
          }
        });

        while (!extendOperation.done) {
          onProgress(`AI đang xử lý phần mở rộng để đạt tổng cộng ${config.duration}s...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          extendOperation = await ai.operations.getVideosOperation({ operation: extendOperation });
        }
        operation = extendOperation;
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Không tìm thấy kết quả từ AI.");

      onProgress("Hoàn tất! Đang chuẩn bị tệp video dài...");
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error: any) {
      console.error("Video generation failed:", error);
      throw error;
    }
  }

  static async hasKey(): Promise<boolean> {
    return await (window as any).aistudio.hasSelectedApiKey();
  }

  static async openKeySelector(): Promise<void> {
    await (window as any).aistudio.openSelectKey();
  }
}
