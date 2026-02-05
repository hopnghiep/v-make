
import React from 'react';
import { VideoService } from '../services/geminiService';

interface ApiKeyScreenProps {
  onKeySelected: () => void;
}

export const ApiKeyScreen: React.FC<ApiKeyScreenProps> = ({ onKeySelected }) => {
  const handleSelectKey = async () => {
    await VideoService.openKeySelector();
    onKeySelected();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold mb-4">Chào mừng bạn đến với V-Maker AI</h2>
      <p className="text-gray-600 max-w-md mb-8">
        Để sử dụng mô hình tạo video <b>Veo 3.1</b> tiên tiến nhất, bạn cần chọn một API Key từ dự án Google Cloud có trả phí.
      </p>
      <button
        onClick={handleSelectKey}
        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg transition-all"
      >
        Chọn API Key & Bắt đầu
      </button>
      <p className="mt-6 text-sm text-gray-400">
        Tìm hiểu thêm về <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-indigo-500">thông tin thanh toán</a>.
      </p>
    </div>
  );
};
