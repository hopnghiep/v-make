
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  isWide?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, isWide = false }) => {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col transition-all duration-500">
      <header className="sticky top-0 z-50 glass-effect border-b border-gray-200 shadow-sm">
        <div className={`${isWide ? 'max-w-none px-6' : 'max-w-6xl'} mx-auto h-24 flex items-center justify-between transition-all duration-500`}>
          <div className="flex items-center gap-5">
            {/* Logo lớn hơn */}
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200 select-none">V</div>
            
            {/* Tiêu đề lớn hơn và thông tin bản quyền */}
            <div className="flex flex-col justify-center">
              <h1 className="text-4xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tighter leading-none mb-1">
                V-Maker AI
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-[0.25em] ml-1">
                  Bản quyền của S-L
                </span>
                <div className="h-[2px] w-8 bg-gradient-to-r from-indigo-200 to-transparent rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Nút Pinterest */}
          <div className="flex items-center gap-4">
            <a 
              href="https://www.pinterest.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-4 py-2 bg-[#E60023] text-white rounded-xl font-bold text-sm shadow-lg hover:bg-[#ad001a] transition-all active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.965 1.406-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.261 7.929-7.261 4.162 0 7.396 2.966 7.396 6.929 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
              </svg>
              <span className="hidden sm:inline">Pinterest</span>
            </a>
          </div>
        </div>
      </header>
      <main className={`flex-1 ${isWide ? 'max-w-none px-6' : 'max-w-6xl'} mx-auto w-full p-4 md:p-8 transition-all duration-500`}>
        {children}
      </main>
      <footer className="py-8 text-center text-gray-500 text-sm border-t border-gray-100">
        <p className="font-medium">&copy; 2024 V-Maker AI - <span className="text-indigo-600">Bản quyền của S-L</span>. Powered by Google Veo & Gemini.</p>
      </footer>
    </div>
  );
};
