// FilePreviewModal.tsx - ProTalk Gallery Preview Modal with Light Theme & Transparency Support
import React, { useState } from 'react';
import { X, Copy, ExternalLink, HardDrive, FileText, Calendar, Check, Link } from 'lucide-react';
import { FileRecord } from '../services/FileUploadService';
import { getShortFileUrl, formatFileNameForUrl } from '../lib/utils';

interface FilePreviewModalProps {
  file: FileRecord | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const [copiedShort, setCopiedShort] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);

  if (!file) return null;

  const formattedName = formatFileNameForUrl(file.name, file.mime_type);
  const shortUrl = getShortFileUrl(file.id, file.name, file.mime_type);
  const keyUrl = getShortFileUrl(file.file_key, file.name, file.mime_type);
  const previewPath = `/file/${file.id}/${formattedName}`;

  const isImage = file.mime_type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(file.name);
  const isVideo = file.mime_type?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
  const isAudio = file.mime_type?.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a)$/i.test(file.name);

  const copyToClipboard = (text: string, type: 'short' | 'original') => {
    navigator.clipboard.writeText(text);
    if (type === 'short') {
      setCopiedShort(true);
      setTimeout(() => setCopiedShort(false), 2000);
    } else {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-stone-50/95 border border-stone-300 rounded-2xl p-6 shadow-2xl overflow-hidden backdrop-blur-xl text-stone-900">
        
        {/* Кнопка закрытия */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-600 hover:text-stone-900 bg-white/80 hover:bg-white border border-stone-300 rounded-full transition shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-stone-900 font-gothic tracking-wide mb-4 pr-10 truncate">{file.name}</h3>

        {/* Область предпросмотра с поддержкой прозрачности PNG на светлом фоне */}
        <div className="relative w-full h-80 rounded-xl overflow-hidden flex items-center justify-center border border-stone-300 bg-white mb-6 shadow-inner">
          {isImage ? (
            /* Светлая шахматная сетка для проверки PNG-прозрачности */
            <div 
              className="w-full h-full flex items-center justify-center p-4"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #e7e2d7 25%, transparent 25%), 
                  linear-gradient(-45deg, #e7e2d7 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #e7e2d7 75%), 
                  linear-gradient(-45deg, transparent 75%, #e7e2d7 75%)
                `,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                backgroundColor: '#ffffff'
              }}
            >
              <img 
                src={previewPath} 
                alt={file.name} 
                className="max-h-full max-w-full object-contain drop-shadow-md rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = file.original_url;
                }}
              />
            </div>
          ) : isVideo ? (
            <video src={previewPath} controls className="max-h-full max-w-full rounded-lg" />
          ) : isAudio ? (
            <audio src={previewPath} controls className="w-4/5" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-stone-500">
              <FileText className="w-16 h-16 text-amber-800/70" />
              <span className="text-sm font-medium text-stone-700">Предпросмотр недоступен ({file.mime_type})</span>
            </div>
          )}
        </div>

        {/* Метаданные файла */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-xs text-stone-800">
          <div className="flex items-center gap-2 bg-white/60 p-3 rounded-xl border border-stone-200 backdrop-blur-sm">
            <HardDrive className="w-4 h-4 text-amber-800 shrink-0" />
            <div>
              <div className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">Размер:</div>
              <div className="font-semibold text-stone-900">{formatBytes(file.file_size)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/60 p-3 rounded-xl border border-stone-200 backdrop-blur-sm">
            <FileText className="w-4 h-4 text-amber-800 shrink-0" />
            <div>
              <div className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">MIME-тип:</div>
              <div className="font-semibold text-stone-900 truncate">{file.mime_type || 'unknown'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/60 p-3 rounded-xl border border-stone-200 backdrop-blur-sm">
            <Calendar className="w-4 h-4 text-amber-800 shrink-0" />
            <div>
              <div className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">Загружен:</div>
              <div className="font-semibold text-stone-900">
                {file.created_at ? new Date(file.created_at).toLocaleDateString('ru-RU') : 'Сегодня'}
              </div>
            </div>
          </div>
        </div>

        {/* Ссылки и кнопки действий */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center bg-white/80 border border-stone-300 rounded-xl px-3 py-2">
            <span className="text-stone-500 text-xs font-mono mr-2 shrink-0">ID:</span>
            <input 
              readOnly 
              value={shortUrl} 
              className="bg-transparent text-xs font-mono text-amber-900 font-bold w-full focus:outline-none" 
            />
            <button 
              onClick={() => copyToClipboard(shortUrl, 'short')}
              className="ml-2 p-1.5 hover:bg-stone-200/80 text-stone-700 hover:text-stone-900 rounded transition flex items-center gap-1 shrink-0"
              title="Копировать красивую ссылку"
            >
              {copiedShort ? <Check className="w-4 h-4 text-amber-800" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1 flex items-center bg-white/80 border border-stone-300 rounded-xl px-3 py-2">
            <span className="text-stone-500 text-xs font-mono mr-2 shrink-0">Ключ:</span>
            <input 
              readOnly 
              value={keyUrl} 
              className="bg-transparent text-xs font-mono text-amber-800 w-full focus:outline-none" 
            />
            <button 
              onClick={() => copyToClipboard(keyUrl, 'original')}
              className="ml-2 p-1.5 hover:bg-stone-200/80 text-stone-700 hover:text-stone-900 rounded transition flex items-center gap-1 shrink-0"
              title="Копировать ссылку по ключу"
            >
              {copiedOriginal ? <Check className="w-4 h-4 text-amber-800" /> : <Link className="w-4 h-4" />}
            </button>
          </div>

          <a 
            href={file.original_url} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded-xl transition shrink-0 shadow-sm"
          >
            <span>Оригинал ProTalk</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </div>
  );
};
