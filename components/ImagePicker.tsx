
import React from 'react';
import { ImageData } from '../types';

interface ImagePickerProps {
  images: ImageData[];
  setImages: React.Dispatch<React.SetStateAction<ImageData[]>>;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ images, setImages }) => {
  const processFiles = async (files: File[]) => {
    // Chỉ lấy các tệp là hình ảnh
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;

    // Cập nhật giới hạn từ 3 lên 5
    if (imageFiles.length + images.length > 5) {
      alert("Bạn chỉ có thể chọn tối đa 5 ảnh.");
      return;
    }

    const newImages: ImageData[] = await Promise.all(
      imageFiles.map(async (file: File) => {
        return new Promise<ImageData>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({
              base64,
              mimeType: file.type,
              previewUrl: URL.createObjectURL(file),
            });
          };
          reader.readAsDataURL(file);
        });
      })
    );

    setImages((prev) => [...prev, ...newImages]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processFiles(files);
    // Reset input để có thể chọn lại cùng một file nếu cần
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items) as DataTransferItem[];
    const files: File[] = [];
    
    items.forEach(item => {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    });

    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files) as File[];
    processFiles(files);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const saveImage = (img: ImageData, index: number) => {
    const link = document.createElement('a');
    link.href = img.previewUrl;
    link.download = `v-maker-photo-${index + 1}.${img.mimeType.split('/')[1] || 'png'}`;
    link.click();
  };

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">Hình ảnh tham chiếu (Tối đa 5)</label>
        <span className="text-xs text-gray-500">{images.length}/5 ảnh</span>
      </div>
      
      {/* Giữ nguyên grid-cols-3 để bố cục không bị xáo trộn khi thêm ảnh */}
      <div className="grid grid-cols-3 gap-4">
        {images.map((img, idx) => (
          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <img src={img.previewUrl} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
            
            {/* Overlay actions on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => saveImage(img, idx)}
                  title="Tải ảnh về máy"
                  className="bg-white/90 text-indigo-600 p-2 rounded-lg hover:bg-white transition-colors shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" />
                  </svg>
                </button>
                <button
                  onClick={() => removeImage(idx)}
                  title="Xóa khỏi danh sách"
                  className="bg-white/90 text-red-600 p-2 rounded-lg hover:bg-white transition-colors shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
        {images.length < 5 && (
          <label 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="mt-2 text-[10px] text-gray-500 font-medium uppercase tracking-tight">Thêm ảnh</span>
            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
          </label>
        )}
      </div>
      <p className="text-[10px] text-gray-400 italic">Mẹo: Bạn có thể Kéo-Thả ảnh hoặc Nhấn Ctrl+V để dán ảnh trực tiếp.</p>
    </div>
  );
};
