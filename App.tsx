
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { ApiKeyScreen } from './components/ApiKeyScreen';
import { ImagePicker } from './components/ImagePicker';
import { Viewer360 } from './components/Viewer360';
import { VideoService } from './services/geminiService';
import { ImageData, VideoConfig, GenerationStatus, AudioData } from './types';

// IndexedDB Helper for persistent video storage
const DB_NAME = 'VMakerLibrary';
const STORE_NAME = 'saved_videos';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveVideoToDB = async (blob: Blob, name: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const id = `vid_${Date.now()}`;
  await tx.objectStore(STORE_NAME).put({ id, blob, name, date: new Date().toISOString() });
};

const getVideosFromDB = async () => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise<any[]>((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

const deleteVideoFromDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).delete(id);
};

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [editorName, setEditorName] = useState<string>('V-maker');
  const [images, setImages] = useState<ImageData[]>([]);
  const [config, setConfig] = useState<VideoConfig>({
    prompt: '',
    musicStyle: 'Điện ảnh, truyền cảm hứng',
    aspectRatio: 'auto',
    resolution: '720p',
    voiceoverScript: '',
    subtitleText: '',
    transitionStyle: 'smooth crossfade',
    duration: 5,
  });
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2D' | '360'>('2D');
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isWideLayout, setIsWideLayout] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
  const [localVideoLibrary, setLocalVideoLibrary] = useState<any[]>([]);
  
  // AI Feature States
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isWritingScript, setIsWritingScript] = useState(false);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const downloadSectionRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Persistence management
  useEffect(() => {
    const initialize = async () => {
      const exists = await VideoService.hasKey();
      setHasKey(exists);

      // Load App State from localStorage
      const storedPrompts = localStorage.getItem('v-maker-saved-prompts');
      if (storedPrompts) setSavedPrompts(JSON.parse(storedPrompts));

      const storedEditor = localStorage.getItem('v-maker-editor-name');
      if (storedEditor) setEditorName(storedEditor);

      const storedImages = localStorage.getItem('v-maker-current-images');
      if (storedImages) {
        try {
          const parsed = JSON.parse(storedImages);
          setImages(parsed);
        } catch (e) { console.error("Error loading images", e); }
      }

      const storedConfig = localStorage.getItem('v-maker-current-config');
      if (storedConfig) {
        try {
          const parsed = JSON.parse(storedConfig);
          setConfig(parsed);
        } catch (e) { console.error("Error loading config", e); }
      }

      // Load Video Library from IndexedDB
      refreshLibrary();
    };
    initialize();

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('v-maker-editor-name', editorName);
  }, [editorName]);

  useEffect(() => {
    localStorage.setItem('v-maker-current-images', JSON.stringify(images));
  }, [images]);

  useEffect(() => {
    localStorage.setItem('v-maker-current-config', JSON.stringify(config));
  }, [config]);

  const refreshLibrary = async () => {
    const vids = await getVideosFromDB();
    setLocalVideoLibrary(vids);
  };

  // Sync video time and duration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (videoUrl) {
        video.play().catch(e => console.log("Auto-play blocked", e));
        setIsPlaying(true);
      }
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoUrl]);

  // AI Intelligence Handlers
  const handleEnhancePrompt = async () => {
    if (!config.prompt.trim()) {
      alert("Vui lòng nhập ý tưởng cơ bản trước khi tối ưu.");
      return;
    }
    try {
      setIsEnhancing(true);
      const enhanced = await VideoService.enhancePrompt(config.prompt, images);
      setConfig({ ...config, prompt: enhanced });
    } catch (err) {
      console.error("Enhance failed", err);
      alert("Không thể tối ưu prompt vào lúc này.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleAutoScript = async () => {
    if (!config.prompt.trim()) {
      alert("Cần có mô tả bối cảnh để AI viết kịch bản phù hợp.");
      return;
    }
    try {
      setIsWritingScript(true);
      const script = await VideoService.generateScript(config.prompt);
      setConfig({ ...config, voiceoverScript: script, subtitleText: script });
    } catch (err) {
      console.error("Script generation failed", err);
      alert("Không thể tạo kịch bản tự động.");
    } finally {
      setIsWritingScript(false);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setConfig({
          ...config,
          audioRef: {
            base64,
            mimeType: file.type,
            fileName: file.name
          }
        });
        setAudioPreview(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAudio = () => {
    setConfig({ ...config, audioRef: undefined });
    setAudioPreview(null);
    if (audioFileRef.current) audioFileRef.current.value = '';
  };

  const handleSavePrompt = () => {
    if (!config.prompt.trim()) return;
    if (savedPrompts.includes(config.prompt.trim())) {
      alert("Prompt này đã tồn tại trong danh sách lưu.");
      return;
    }
    const newList = [config.prompt.trim(), ...savedPrompts].slice(0, 10);
    setSavedPrompts(newList);
    localStorage.setItem('v-maker-saved-prompts', JSON.stringify(newList));
    alert("Đã lưu prompt thành công!");
  };

  const handleSelectSavedPrompt = (prompt: string) => {
    setConfig({ ...config, prompt });
  };

  const handleDeleteSavedPrompt = (e: React.MouseEvent, promptToDelete: string) => {
    e.stopPropagation();
    const newList = savedPrompts.filter(p => p !== promptToDelete);
    setSavedPrompts(newList);
    localStorage.setItem('v-maker-saved-prompts', JSON.stringify(newList));
  };

  const handleReset = () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ nội dung và làm mới app không?")) {
      localStorage.removeItem('v-maker-current-images');
      localStorage.removeItem('v-maker-current-config');
      localStorage.removeItem('v-maker-editor-name');
      localStorage.removeItem('v-maker-saved-prompts');
      window.location.reload();
    }
  };

  const handleDeleteVideo = () => {
    if (confirm("Bạn có chắc chắn muốn xóa video hiện tại không?")) {
      setVideoUrl(null);
      setStatus(GenerationStatus.IDLE);
      setIsFinished(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  };

  const handleSaveVideoToApp = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const videoName = config.prompt.substring(0, 30) || 'Video không tên';
      await saveVideoToDB(blob, `${videoName}...`);
      await refreshLibrary();
      alert("Đã lưu video vào thư viện của App!");
    } catch (e) {
      alert("Lỗi khi lưu video vào App.");
    }
  };

  const handleLoadFromLibrary = (blob: Blob) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(blob);
    setVideoUrl(url);
    setStatus(GenerationStatus.COMPLETED);
    setIsFinished(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteFromLibrary = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Xóa video này khỏi thư viện App?")) {
      await deleteVideoFromDB(id);
      await refreshLibrary();
    }
  };

  const handleExportProject = () => {
    const projectData = {
      version: "1.0",
      editorName,
      images,
      config
    };
    
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    const safeEditorName = editorName.trim() || 'V-maker';
    const fileName = `${safeEditorName}_${d}-${m}-${y} _lúc_${h}h${min}.json`;

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.images && data.config) {
          const restoredImages = data.images.map((img: ImageData) => ({
            ...img,
            previewUrl: `data:${img.mimeType};base64,${img.base64}`
          }));
          setImages(restoredImages);
          setConfig(data.config);
          if (data.editorName) setEditorName(data.editorName);
          alert("Nhập cấu hình thành công!");
        } else {
          alert("Tệp cấu hình không hợp lệ.");
        }
      } catch (err) {
        alert("Lỗi khi đọc tệp cấu hình.");
      }
    };
    reader.readAsText(file);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (images.length === 0) {
      alert("Vui lòng chọn ít nhất 1 ảnh.");
      return;
    }
    if (!config.prompt.trim()) {
      alert("Vui lòng nhập mô tả video.");
      return;
    }

    try {
      setStatus(GenerationStatus.GENERATING);
      setVideoUrl(null);
      setIsFinished(false);
      const url = await VideoService.generateVideo(images, config, setProgressMsg);
      setVideoUrl(url);
      setStatus(GenerationStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
      }
      setStatus(GenerationStatus.ERROR);
      setProgressMsg(`Lỗi: ${err.message || "Lỗi tạo video."}`);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setIsFinished(true);
    setTimeout(() => {
      downloadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const replayVideo = () => {
    if (videoRef.current) {
      setIsFinished(false);
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
    }
  };

  const openFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        alert(`Không thể kích hoạt toàn màn hình: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (hasKey === null) return <div className="p-8 text-center font-medium text-gray-400 animate-pulse">Đang khởi tạo hệ thống AI...</div>;
  if (hasKey === false) return <Layout><ApiKeyScreen onKeySelected={() => setHasKey(true)} /></Layout>;

  return (
    <Layout isWide={isWideLayout}>
      <div className={`grid grid-cols-1 ${isTheaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-8 transition-all duration-500 ease-in-out`}>
        {/* Cột trái: Cấu hình */}
        <div className={`space-y-6 ${isTheaterMode ? 'hidden overflow-hidden' : 'max-h-[calc(100vh-200px)] overflow-y-auto'} pr-2 custom-scrollbar transition-all duration-500`}>
          
          {/* Project Manager Card */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tên người chỉnh sửa</label>
                <span className="text-[9px] text-gray-300 font-mono">APP-STORAGE-v1.0</span>
              </div>
              <input 
                type="text" 
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="Ví dụ: V-maker"
                className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleExportProject}
                title="Lưu toàn bộ cấu hình hiện tại xuống máy tính (.json)"
                className="flex-1 min-w-[100px] py-2.5 px-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Lưu cấu hình
              </button>
              <button 
                onClick={() => importFileRef.current?.click()}
                title="Tải lên tệp cấu hình .json đã lưu trước đó"
                className="flex-1 min-w-[100px] py-2.5 px-4 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Nhập cấu hình
              </button>
              <button 
                onClick={handleReset}
                title="Xóa mọi thứ cục bộ và làm mới app"
                className="flex-1 min-w-[100px] py-2.5 px-4 bg-red-50 text-red-700 border border-red-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-100 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Làm mới App
              </button>
            </div>
            <input 
              type="file" 
              ref={importFileRef} 
              className="hidden" 
              accept=".json" 
              onChange={handleImportProject} 
            />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
              Cấu hình Video
            </h2>

            <ImagePicker images={images} setImages={setImages} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">Mô tả bối cảnh & chuyển động</label>
                <div className="flex gap-2">
                  <button 
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing}
                    title="Dùng Gemini AI để tối ưu mô tả video chuyên nghiệp hơn"
                    className={`p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100 flex items-center gap-1.5 ${isEnhancing ? 'animate-pulse' : ''}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isEnhancing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-[10px] font-bold">Magic Enhance</span>
                  </button>
                  <button 
                    onClick={handleSavePrompt}
                    title="Lưu prompt này vào danh sách yêu thích"
                    className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  </button>
                </div>
              </div>
              <textarea
                value={config.prompt}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="Ví dụ: Camera lướt qua cánh đồng hoa, ánh sáng huyền ảo..."
                className="w-full h-24 p-3 text-sm bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {savedPrompts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prompt đã lưu gần đây</p>
                  <div className="flex flex-col gap-1.5">
                    {savedPrompts.map((p, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleSelectSavedPrompt(p)}
                        className="group flex items-center justify-between p-2 text-[11px] bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 rounded-lg cursor-pointer transition-all"
                      >
                        <span className="truncate flex-1 pr-2 text-gray-600 group-hover:text-indigo-700">{p}</span>
                        <button 
                          onClick={(e) => handleDeleteSavedPrompt(e, p)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Audio Section */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-4">
              <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Âm thanh nền (Tùy chọn)
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-emerald-700">Phong cách nhạc mặc định</label>
                  <select
                    value={config.musicStyle}
                    onChange={(e) => setConfig({ ...config, musicStyle: e.target.value })}
                    className="w-full p-2.5 text-xs bg-white border border-emerald-200 rounded-lg outline-none cursor-pointer"
                  >
                    <option value="Điện ảnh, truyền cảm hứng">Điện ảnh, truyền cảm hứng (Mặc định)</option>
                    <option value="Sôi động, EDM">Sôi động, EDM</option>
                    <option value="Nhẹ nhàng, Piano">Nhẹ nhàng, Piano</option>
                    <option value="Hùng tráng, Epic">Hùng tráng, Epic</option>
                    <option value="Cổ điển, Jazz">Cổ điển, Jazz</option>
                    <option value="Bí ẩn, Lo-fi">Bí ẩn, Lo-fi</option>
                  </select>
                </div>
                
                <div className="border-t border-emerald-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-700">Tải lên nhạc của riêng bạn</span>
                  </div>
                  
                  {!config.audioRef ? (
                    <button
                      onClick={() => audioFileRef.current?.click()}
                      className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Chọn tệp âm thanh
                    </button>
                  ) : (
                    <div className="bg-white p-3 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-emerald-100 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 3v11H4a1 1 0 00-1 1v3a1 1 0 001 1h2a1 1 0 001-1V7.89l8-1.6V11h-2a1 1 0 00-1 1v3a1 1 0 001 1h2a1 1 0 001-1V3z" />
                          </svg>
                        </div>
                        <div className="truncate">
                          <p className="text-[10px] font-bold text-gray-700 truncate">{config.audioRef.fileName}</p>
                          <p className="text-[9px] text-gray-400">Sẵn sàng phân tích</p>
                        </div>
                      </div>
                      <button onClick={removeAudio} className="text-red-400 hover:text-red-600 p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {audioPreview && (
                    <div className="mt-2">
                      <audio src={audioPreview} controls className="w-full h-8" />
                    </div>
                  )}
                  <input type="file" ref={audioFileRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-orange-900 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Độ dài video
                </h3>
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">{config.duration} giây</span>
              </div>
              <input 
                type="range" min="5" max="15" step="1"
                value={config.duration}
                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />
            </div>

            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4">
              <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Hiệu ứng chuyển cảnh
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {['smooth crossfade', 'dynamic zoom in', 'fluid morphing', 'cinematic pan'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setConfig({ ...config, transitionStyle: style })}
                    className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                      config.transitionStyle === style ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {style.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Voiceover & Subtitles Section */}
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Thuyết minh & Phụ đề
                </h3>
                <button 
                  onClick={handleAutoScript}
                  disabled={isWritingScript}
                  className={`flex items-center gap-1.5 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all ${isWritingScript ? 'animate-pulse' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${isWritingScript ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  AI Write ✍️
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Văn bản thuyết minh (AI Voice)</label>
                  <textarea
                    value={config.voiceoverScript}
                    onChange={(e) => setConfig({ ...config, voiceoverScript: e.target.value })}
                    placeholder="AI sẽ đọc nội dung này..."
                    className="w-full h-20 p-2.5 text-xs bg-white border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Nội dung phụ đề</label>
                  <input
                    type="text"
                    value={config.subtitleText}
                    onChange={(e) => setConfig({ ...config, subtitleText: e.target.value })}
                    placeholder="Phụ đề hiển thị trên màn hình..."
                    className="w-full p-2.5 text-xs bg-white border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Tỷ lệ</label>
                <select
                  value={config.aspectRatio}
                  onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as any })}
                  className="w-full p-2 text-xs bg-gray-50 border rounded-lg outline-none cursor-pointer"
                >
                  <option value="auto">Tự động (Auto)</option>
                  <option value="16:9">Ngang (16:9)</option>
                  <option value="9:16">Dọc (9:16)</option>
                  <option value="1:1">Vuông (1:1)</option>
                  <option value="4:3">Cổ điển (4:3)</option>
                  <option value="3:4">Portrait (3:4)</option>
                  <option value="21:9">Siêu rộng (21:9)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Độ phân giải</label>
                <select
                  value={config.resolution}
                  onChange={(e) => setConfig({ ...config, resolution: e.target.value as any })}
                  className="w-full p-2 text-xs bg-gray-50 border rounded-lg outline-none"
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={status === GenerationStatus.GENERATING}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${
                status === GenerationStatus.GENERATING ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 active:scale-[0.98]'
              }`}
            >
              {status === GenerationStatus.GENERATING ? 'Đang tạo video nghệ thuật...' : 'Bắt đầu tạo Video'}
            </button>
          </div>
        </div>

        {/* Cột phải: Xem trước */}
        <div className={`space-y-6 flex flex-col h-full transition-all duration-500`}>
          <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col ${isTheaterMode ? 'min-h-[70vh]' : 'min-h-[500px]'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
                Phòng chiếu phim AI
              </h2>
              
              <div className="flex items-center gap-2">
                {/* Interface Controls */}
                <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
                  <button 
                    onClick={() => setIsWideLayout(!isWideLayout)}
                    className={`p-1.5 rounded-md transition-all ${isWideLayout ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title={isWideLayout ? "Thu gọn giao diện" : "Mở rộng giao diện (Wide Mode)"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                  <button 
                    onClick={toggleBrowserFullscreen}
                    className={`p-1.5 rounded-md transition-all ${isFullscreen ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title={isFullscreen ? "Thoát toàn màn hình trình duyệt" : "Toàn màn hình trình duyệt"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6m0 0v6m0-6L14 10M9 21H3m0 0v-6m0 6l7-7" />
                    </svg>
                  </button>
                  <div className="w-[1px] bg-gray-200 mx-1 self-stretch"></div>
                  <button 
                    onClick={() => setIsTheaterMode(!isTheaterMode)}
                    className={`p-1.5 rounded-md transition-all ${isTheaterMode ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title={isTheaterMode ? "Thu nhỏ phòng chiếu" : "Mở rộng phòng chiếu (Theater Mode)"}
                  >
                    {isTheaterMode ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    )}
                  </button>
                </div>

                {videoUrl && (
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setViewMode('2D')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === '2D' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}
                    >
                      2D
                    </button>
                    <button 
                      onClick={() => setViewMode('360')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === '360' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}
                    >
                      360°
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center relative border-4 border-gray-800 shadow-inner group transition-all duration-500`}>
              {videoUrl && (
                <video 
                  ref={videoRef}
                  src={videoUrl} 
                  onEnded={handleVideoEnd}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  muted={volume === 0}
                  className={`${viewMode === '2D' ? 'w-full h-full object-contain' : 'hidden'} cursor-pointer`}
                  onClick={togglePlay}
                  playsInline
                />
              )}

              {videoUrl && viewMode === '360' && (
                <Viewer360 videoElement={videoRef.current} />
              )}

              {status === GenerationStatus.IDLE && (
                <div className="text-center text-gray-500 p-8">
                  <p className="font-medium">Mời bạn thiết lập cấu hình và nhấn nút Tạo Video</p>
                </div>
              )}

              {status === GenerationStatus.GENERATING && (
                <div className="text-center space-y-4 px-8">
                  <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-300 text-sm animate-pulse">{progressMsg}</p>
                </div>
              )}

              {/* Video Controls Overlay */}
              {videoUrl && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end pointer-events-none">
                  <div className="pointer-events-auto p-4 space-y-3">
                    {/* SEEK BAR (Progress Slider) */}
                    <div className="relative group/seek">
                      <div className="flex justify-between text-[10px] text-white/90 font-mono mb-2 px-1">
                        <span className="bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">{formatTime(currentTime)}</span>
                        <span className="bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">{formatTime(duration)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max={duration || 0} 
                        step="0.01" 
                        value={currentTime} 
                        onChange={handleSeek}
                        className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white transition-all hover:h-2"
                        style={{
                          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform bg-indigo-600/20 p-2 rounded-full backdrop-blur-sm border border-white/10">
                          {isPlaying ? (
                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          ) : (
                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                          )}
                        </button>
                        <button onClick={replayVideo} className="text-white/80 hover:text-white transition-colors">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="relative group/vol flex items-center" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
                          {showVolumeSlider && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 h-24 flex items-center justify-center">
                               <input type="range" min="0" max="1" step="0.1" value={volume} onChange={handleVolumeChange} className="w-16 h-1 -rotate-90 appearance-none bg-white/20 rounded-full accent-indigo-500 cursor-pointer" />
                            </div>
                          )}
                          <button className="text-white/80 hover:text-white transition-colors">
                            {volume === 0 ? (
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            ) : (
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" /></svg>
                            )}
                          </button>
                        </div>
                        <button onClick={openFullscreen} className="text-white/80 hover:text-white transition-colors">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 8V4m0 0h4M3 4l4 4m8 0V4m0 0h-4m4 0l-4 4m-8 4v4m0 0h4m-4 0l4-4m8 4v-4m0 0h-4m4 0l-4-4" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Minimalist Persistent Progress Bar */}
              {videoUrl && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 group-hover:opacity-0 transition-opacity pointer-events-none">
                  <div 
                    className="h-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" 
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
              )}

              {status === GenerationStatus.ERROR && (
                <div className="text-red-400 p-8 text-center bg-red-900/10 w-full h-full flex flex-col items-center justify-center">
                  <p className="font-bold">Đã có lỗi xảy ra</p>
                  <p className="text-xs mt-2">{progressMsg}</p>
                  <button onClick={() => setStatus(GenerationStatus.IDLE)} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Thử lại</button>
                </div>
              )}
            </div>

            {videoUrl && (
              <div ref={downloadSectionRef} className="mt-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <a 
                    href={videoUrl} download="v-maker-ai.mp4" 
                    title="Tải video về thiết bị của bạn"
                    className={`flex-[1.5] py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-center hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 ${isFinished ? 'animate-pulse ring-4 ring-indigo-500/20 shadow-xl shadow-indigo-500/20' : ''}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Lưu về máy
                  </a>
                  <button 
                    onClick={handleSaveVideoToApp}
                    title="Lưu video vào thư viện cục bộ của App để xem lại sau"
                    className="flex-1 py-3.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                    Lưu vào App
                  </button>
                  <button 
                    onClick={handleDeleteVideo}
                    title="Xóa video này khỏi phòng chiếu"
                    className="px-4 py-3.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Xóa Video
                  </button>
                </div>
              </div>
            )}

            {/* Video Library Section - Persistent Local Storage */}
            {localVideoLibrary.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Thư viện Video đã lưu (Cục bộ)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {localVideoLibrary.map((vid) => (
                    <div 
                      key={vid.id}
                      onClick={() => handleLoadFromLibrary(vid.blob)}
                      className="group relative aspect-video bg-gray-900 rounded-lg overflow-hidden cursor-pointer border border-gray-200 hover:ring-2 hover:ring-purple-500 transition-all"
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white opacity-50 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[9px] text-white font-medium truncate">{vid.name}</p>
                        <p className="text-[7px] text-gray-300 font-mono">{new Date(vid.date).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteFromLibrary(e, vid.id)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-short { animation: bounce-short 2s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        
        /* Seek Bar Custom Styling */
        input[type='range']::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #6366f1;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.5);
        }
        input[type='range']::-moz-range-thumb {
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #6366f1;
        }
      `}</style>
    </Layout>
  );
};

export default App;
