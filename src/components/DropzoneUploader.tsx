// DropzoneUploader.tsx - Drag & Drop Batch File Uploader Component for ProTalk
import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { getUploadService } from '../services/FileUploadService';

interface DropzoneUploaderProps {
  folderId?: number | null;
  onUploadSuccess: () => void;
}

export const DropzoneUploader: React.FC<DropzoneUploaderProps> = ({ folderId, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setUploading(true);
    const uploadService = getUploadService();

    try {
      await uploadService.uploadBatch(Array.from(files), folderId, (loaded, total) => {
        setProgress({ loaded, total });
      });
      onUploadSuccess();
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMsg(err.message || 'Ошибка при массовой загрузке файлов');
    } finally {
      setUploading(false);
      setProgress({ loaded: 0, total: 0 });
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300 backdrop-blur-md ${
          isDragging 
            ? 'border-amber-700 bg-amber-500/20 scale-[1.01] shadow-lg shadow-amber-900/10' 
            : 'border-amber-900/30 hover:border-amber-800/60 bg-white/40 hover:bg-white/60'
        }`}
      >
        <input 
          ref={fileInputRef} 
          type="file" 
          multiple 
          className="hidden" 
          onChange={(e) => handleFiles(e.target.files)} 
        />

        <div className="flex flex-col items-center justify-center gap-3">
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 text-amber-800 animate-spin" />
              <p className="text-sm font-semibold text-stone-900">
                Загрузка {progress.loaded} из {progress.total} файлов...
              </p>
              <div className="w-56 bg-stone-200/80 border border-amber-900/20 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-700 to-amber-900 h-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 bg-amber-100/60 border border-amber-900/20 rounded-full text-amber-900 shadow-inner group-hover:scale-110 transition">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-bold text-stone-900 font-gothic tracking-wide">
                  Перетащите сюда файлы или кликните для выбора
                </p>
                <p className="text-xs text-stone-700 mt-1 font-mono">
                  Поддержка PNG (с прозрачным фоном), JPG, SVG, GIF, PDF, MP3, MP4, WEBP и ZIP
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-2 text-xs text-red-900 bg-red-100/60 border border-red-300 p-2.5 rounded-xl backdrop-blur-md">
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
};
