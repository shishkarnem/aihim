// FileCloudManager.tsx - ProTalk Cloud File Store & Gallery Interface
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Cloud, FolderPlus, Search, Grid, List, Trash2, Folder, 
  Eye, Copy, Key, Settings, RefreshCw, Check, MoveRight, 
  HardDrive, FileText, Image as ImageIcon, Film, Music, Code, AlertCircle, Pencil
} from 'lucide-react';
import { FileRecord, FileFolder, getUploadService, DEFAULT_TOKEN } from '../services/FileUploadService';
import { DropzoneUploader } from './DropzoneUploader';
import { FilePreviewModal } from './FilePreviewModal';
import { NeurosphereLoader } from './ui/NeurosphereLoader';
import { getShortFileUrl, formatFileNameForUrl } from '../lib/utils';

async function fetchJsonWithTimeout(url: string, timeoutMs = 12000, attempt = 1): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      if (attempt < 2 && (res.status >= 500 || res.status === 429)) {
        await new Promise(r => setTimeout(r, 450));
        return fetchJsonWithTimeout(url, timeoutMs, attempt + 1);
      }
      throw new Error(`Ошибка ответа сервера (HTTP ${res.status})`);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 450));
      return fetchJsonWithTimeout(url, timeoutMs, attempt + 1);
    }
    if (err?.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа от сервера файлов');
    }
    throw err;
  }
}

export const FileCloudManager: React.FC = () => {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | 'all' | 'root'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePreviewFile, setActivePreviewFile] = useState<FileRecord | null>(null);
  const latestFilesReqRef = useRef(0);

  // Custom Modals State
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  const [fileToEdit, setFileToEdit] = useState<FileRecord | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editFolderId, setEditFolderId] = useState<number | null>(null);
  const [editMimeType, setEditMimeType] = useState('');

  // Delete Folder Modal
  const [folderToDelete, setFolderToDelete] = useState<FileFolder | null>(null);

  // New Folder Modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#b45309');

  // Move File Modal
  const [movingFile, setMovingFile] = useState<FileRecord | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);

  // Settings / Token Modal
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load Folders & Files
  const fetchFolders = useCallback(async () => {
    try {
      const data = await fetchJsonWithTimeout('/api/admin/file-folders', 10000);
      if (Array.isArray(data)) {
        setFolders(data);
      }
    } catch (e) {
      console.error('Error fetching file folders:', e);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    const reqId = ++latestFilesReqRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      let url = '/api/admin/files?';
      if (selectedFolderId !== 'all') {
        url += `folder_id=${selectedFolderId}&`;
      }
      if (searchQuery.trim()) {
        url += `search=${encodeURIComponent(searchQuery.trim())}&`;
      }

      const data = await fetchJsonWithTimeout(url, 12000);
      if (reqId !== latestFilesReqRef.current) return;
      setFiles(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (reqId !== latestFilesReqRef.current) return;
      console.error('Error fetching files:', e);
      setLoadError(e?.message || 'Не удалось загрузить список файлов из базы данных');
    } finally {
      if (reqId === latestFilesReqRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedFolderId, searchQuery]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch('/api/admin/file-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), color: newFolderColor })
      });
      if (res.ok) {
        setNewFolderName('');
        setIsFolderModalOpen(false);
        fetchFolders();
      }
    } catch (e) {
      console.error('Error creating folder', e);
    }
  };

  // Confirm Delete Folder
  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      const res = await fetch(`/api/admin/file-folders/${folderToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedFolderId === folderToDelete.id) setSelectedFolderId('all');
        setFolderToDelete(null);
        fetchFolders();
        fetchFiles();
      }
    } catch (e) {
      console.error('Error deleting folder', e);
    }
  };

  // Confirm Delete File
  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      const res = await fetch(`/api/admin/files/${fileToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setFileToDelete(null);
        fetchFiles();
      }
    } catch (e) {
      console.error('Error deleting file', e);
    }
  };

  // Open Edit File Modal
  const handleOpenEditFile = (file: FileRecord) => {
    setFileToEdit(file);
    setEditFileName(file.name || '');
    setEditFolderId(file.folder_id ?? null);
    setEditMimeType(file.mime_type || 'application/octet-stream');
  };

  // Confirm Edit File
  const handleConfirmEditFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToEdit || !editFileName.trim()) return;
    try {
      const res = await fetch(`/api/admin/files/${fileToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFileName.trim(),
          folder_id: editFolderId,
          mime_type: editMimeType.trim()
        })
      });
      if (res.ok) {
        setFileToEdit(null);
        fetchFiles();
      }
    } catch (e) {
      console.error('Error updating file', e);
    }
  };

  // Handle Move File
  const handleMoveFile = async () => {
    if (!movingFile) return;
    try {
      const res = await fetch(`/api/admin/files/${movingFile.id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: targetFolderId })
      });
      if (res.ok) {
        setMovingFile(null);
        fetchFiles();
      }
    } catch (e) {
      console.error('Error moving file', e);
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const saveToken = () => {
    const uploadService = getUploadService();
    uploadService.setToken(tokenInput.trim() || DEFAULT_TOKEN);
    setIsTokenModalOpen(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalStorageSize = files.reduce((acc, f) => acc + (f.file_size || 0), 0);

  const getFileIcon = (file: FileRecord) => {
    const mime = file.mime_type || '';
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-amber-800" />;
    if (mime.startsWith('video/')) return <Film className="w-5 h-5 text-amber-800" />;
    if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-amber-800" />;
    if (mime.includes('pdf') || mime.includes('text')) return <FileText className="w-5 h-5 text-amber-800" />;
    return <Code className="w-5 h-5 text-stone-600" />;
  };

  return (
    <div className="space-y-6 text-stone-900">
      
      {/* Верхняя карточка с описанием и статистикой */}
      <div className="p-6 bg-gradient-to-r from-white/60 via-amber-50/40 to-white/60 border border-stone-300/60 rounded-2xl shadow-lg backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100/80 border border-amber-900/20 text-amber-900 rounded-xl shadow-sm">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900 font-gothic tracking-wide">Облачное Хранилище и Галерея ProTalk</h2>
                <p className="text-xs text-stone-700 mt-0.5">
                  Единое файловое облако для PNG (с прозрачным фоном), видео, документов, аудио с поддержкой красивых ссылок <code className="text-amber-950 bg-amber-100/80 px-1 py-0.5 rounded font-mono border border-amber-900/20">/file/:id/:filename</code>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTokenInput(getUploadService().getToken());
                setIsTokenModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/70 hover:bg-white border border-stone-300 text-xs font-semibold rounded-xl transition text-stone-900 shadow-sm"
            >
              <Settings className="w-4 h-4 text-amber-800" />
              <span>Токен ProTalk</span>
            </button>

            <button
              onClick={() => { fetchFolders(); fetchFiles(); }}
              className="p-2 bg-white/70 hover:bg-white border border-stone-300 text-stone-900 rounded-xl transition shadow-sm"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-800' : ''}`} />
            </button>
          </div>
        </div>

        {/* Метрики хранилища */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-stone-300/40">
          <div className="bg-white/50 p-3 rounded-xl border border-stone-300/40 backdrop-blur-sm">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-600">Всего файлов</span>
            <div className="text-lg font-extrabold text-amber-900 mt-0.5">{files.length}</div>
          </div>

          <div className="bg-white/50 p-3 rounded-xl border border-stone-300/40 backdrop-blur-sm">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-600">Объем файлов</span>
            <div className="text-lg font-extrabold text-stone-900 mt-0.5">{formatBytes(totalStorageSize)}</div>
          </div>

          <div className="bg-white/50 p-3 rounded-xl border border-stone-300/40 backdrop-blur-sm">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-600">Папок в галерее</span>
            <div className="text-lg font-extrabold text-amber-800 mt-0.5">{folders.length}</div>
          </div>

          <div className="bg-white/50 p-3 rounded-xl border border-stone-300/40 backdrop-blur-sm">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-600">Статус Хранилища</span>
            <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
              PostgreSQL Таблица Активна
            </div>
          </div>
        </div>
      </div>

      {/* Зона загрузки файлов */}
      <DropzoneUploader 
        folderId={typeof selectedFolderId === 'number' ? selectedFolderId : null}
        onUploadSuccess={() => { fetchFiles(); fetchFolders(); }}
      />

      {/* Фильтры, Папки и Поиск */}
      <div className="bg-white/40 border border-stone-300/60 rounded-2xl p-4 shadow-md space-y-4 backdrop-blur-md">
        
        {/* Папки */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedFolderId('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 ${
              selectedFolderId === 'all'
                ? 'bg-amber-800 text-white shadow-md font-bold'
                : 'bg-white/50 hover:bg-white border border-stone-300 text-stone-900'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Все файлы</span>
          </button>

          <button
            onClick={() => setSelectedFolderId('root')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 ${
              selectedFolderId === 'root'
                ? 'bg-amber-800 text-white shadow-md font-bold'
                : 'bg-white/50 hover:bg-white border border-stone-300 text-stone-900'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-stone-500" />
            <span>Без папки</span>
          </button>

          {folders.map(f => (
            <div key={f.id} className="relative group inline-flex items-center">
              <button
                onClick={() => setSelectedFolderId(f.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 border ${
                  selectedFolderId === f.id
                    ? 'bg-amber-800 text-white border-amber-900 shadow-md font-bold'
                    : 'bg-white/50 hover:bg-white text-stone-900 border-stone-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color || '#b45309' }} />
                <span>{f.name}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setFolderToDelete(f); }}
                className="opacity-0 group-hover:opacity-100 -ml-2 mr-1 p-1 text-stone-500 hover:text-red-700 transition"
                title="Удалить папку"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-100/60 hover:bg-amber-200/80 text-amber-900 border border-amber-900/20 transition flex items-center gap-1.5 ml-auto shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Новая папка</span>
          </button>
        </div>

        {/* Панель поиска и переключения вида */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-stone-300/30">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск файла по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/70 border border-stone-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder-stone-500 focus:outline-none focus:border-amber-800 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white/70 p-1 rounded-xl border border-stone-300 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-amber-800 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
              title="Сетка"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-amber-800 text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
              title="Список"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Список файлов */}
      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center bg-transparent">
          <NeurosphereLoader label="Загрузка" size="md" />
        </div>
      ) : loadError ? (
        <div className="py-12 px-4 text-center border border-red-300/60 rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm bg-transparent space-y-3">
          <AlertCircle className="w-9 h-9 text-red-700 mx-auto" />
          <p className="text-red-800 font-medium text-[14px]">{loadError}</p>
          <button
            type="button"
            onClick={() => { fetchFolders(); fetchFiles(); }}
            className="px-5 py-2 rounded-full bg-amber-800 hover:bg-amber-900 text-parchment text-[14px] font-medium transition cursor-pointer"
          >
            Повторить загрузку
          </button>
        </div>
      ) : files.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-stone-300 rounded-2xl bg-transparent">
          <AlertCircle className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <p className="text-stone-900 font-medium text-[14px]">В этой категории нет файлов</p>
          <p className="text-[14px] text-stone-600 mt-1">Загрузите файлы с помощью области загрузки выше</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Сетка файлов */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => {
            const isImage = file.mime_type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(file.name);
            const formattedName = formatFileNameForUrl(file.name, file.mime_type);
            const shortUrl = getShortFileUrl(file.id, file.name, file.mime_type);
            const keyUrl = getShortFileUrl(file.file_key, file.name, file.mime_type);
            const displayPath = `/file/${file.id}/${formattedName}`;

            return (
              <div 
                key={file.id} 
                className="bg-white/60 border border-stone-300/70 hover:border-amber-800/60 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition duration-300 group flex flex-col justify-between backdrop-blur-sm"
              >
                <div>
                  {/* Область превью с чистым светлым фоном для PNG */}
                  <div className="relative w-full h-40 rounded-xl overflow-hidden mb-3 border border-stone-200/80 bg-white flex items-center justify-center">
                    {isImage ? (
                      <div 
                        className="w-full h-full flex items-center justify-center p-2 cursor-pointer"
                        onClick={() => setActivePreviewFile(file)}
                        style={{
                          backgroundImage: `
                            linear-gradient(45deg, #e7e2d7 25%, transparent 25%), 
                            linear-gradient(-45deg, #e7e2d7 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #e7e2d7 75%), 
                            linear-gradient(-45deg, transparent 75%, #e7e2d7 75%)
                          `,
                          backgroundSize: '16px 16px',
                          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <img 
                          src={displayPath} 
                          alt={file.name} 
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300 drop-shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = file.original_url;
                          }}
                        />
                      </div>
                    ) : (
                      <div 
                        className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer bg-amber-50/40"
                        onClick={() => setActivePreviewFile(file)}
                      >
                        {getFileIcon(file)}
                        <span className="text-[11px] font-mono text-stone-600 truncate max-w-[90%]">
                          {file.mime_type || 'Файл'}
                        </span>
                      </div>
                    )}

                    {/* Кнопка быстрого предпросмотра */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                      <button
                        onClick={() => setActivePreviewFile(file)}
                        className="p-1.5 bg-white/90 hover:bg-white text-stone-900 rounded-lg shadow transition border border-stone-300"
                        title="Открыть предпросмотр"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditFile(file)}
                        className="p-1.5 bg-white/90 hover:bg-white text-stone-900 rounded-lg shadow transition border border-stone-300"
                        title="Редактировать файл"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setMovingFile(file); setTargetFolderId(file.folder_id); }}
                        className="p-1.5 bg-white/90 hover:bg-white text-stone-900 rounded-lg shadow transition border border-stone-300"
                        title="Переместить в папку"
                      >
                        <Folder className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => copyUrl(shortUrl, `short_${file.id}`)}
                        className="p-1.5 bg-white/90 hover:bg-white text-stone-900 rounded-lg shadow transition border border-stone-300"
                        title="Копировать красивую ссылку"
                      >
                        {copiedKey === `short_${file.id}` ? <Check className="w-3.5 h-3.5 text-amber-800" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Название файла */}
                  <div className="space-y-1 mb-2">
                    <h4 
                      onClick={() => setActivePreviewFile(file)}
                      className="text-xs font-bold text-stone-900 truncate hover:text-amber-800 cursor-pointer" 
                      title={file.name}
                    >
                      {file.name}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-stone-600 font-mono">
                      <span>{formatBytes(file.file_size)}</span>
                      <span className="text-amber-900 font-semibold truncate max-w-[130px]">{displayPath}</span>
                    </div>
                  </div>
                </div>

                {/* Нижние кнопки скопировать и удалить */}
                <div className="pt-2 border-t border-stone-200 flex items-center justify-between gap-1">
                  <button
                    onClick={() => copyUrl(shortUrl, `link_${file.id}`)}
                    className="text-[11px] font-mono text-stone-700 hover:text-amber-900 transition flex items-center gap-1 truncate max-w-[150px]"
                    title={shortUrl}
                  >
                    <Copy className="w-3 h-3 text-amber-800 shrink-0" />
                    <span className="truncate">{copiedKey === `link_${file.id}` ? 'Скопировано!' : displayPath}</span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditFile(file)}
                      className="p-1 text-stone-500 hover:text-amber-800 transition"
                      title="Редактировать"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setFileToDelete(file)}
                      className="p-1 text-stone-400 hover:text-red-700 transition"
                      title="Удалить файл"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Табличный вид */
        <div className="bg-white/50 border border-stone-300 rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-900">
              <thead className="bg-amber-100/50 border-b border-stone-300 font-bold uppercase tracking-wider text-[10px] text-stone-700">
                <tr>
                  <th className="p-3.5">Файл</th>
                  <th className="p-3.5">Размер</th>
                  <th className="p-3.5">MIME тип</th>
                  <th className="p-3.5">Ссылка</th>
                  <th className="p-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {files.map((file) => {
                  const formattedName = formatFileNameForUrl(file.name, file.mime_type);
                  const shortUrl = getShortFileUrl(file.id, file.name, file.mime_type);
                  const displayPath = `/file/${file.id}/${formattedName}`;
                  return (
                    <tr key={file.id} className="hover:bg-amber-50/50 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white border border-stone-300 rounded-lg shrink-0">
                            {getFileIcon(file)}
                          </div>
                          <div>
                            <div 
                              onClick={() => setActivePreviewFile(file)}
                              className="font-bold text-stone-900 hover:text-amber-800 cursor-pointer truncate max-w-xs"
                              title={file.name}
                            >
                              {file.name}
                            </div>
                            <div className="text-[10px] text-stone-500 font-mono">ID: {file.id} | Key: {file.file_key}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-stone-700 whitespace-nowrap">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="p-3.5 font-mono text-stone-600 whitespace-nowrap">
                        {file.mime_type || '—'}
                      </td>
                      <td className="p-3.5 font-mono whitespace-nowrap">
                        <button
                          onClick={() => copyUrl(shortUrl, `tbl_${file.id}`)}
                          className="px-2 py-1 bg-white border border-stone-300 hover:border-amber-800 rounded text-amber-900 font-semibold transition flex items-center gap-1.5 text-[11px] max-w-xs truncate shadow-sm"
                          title={shortUrl}
                        >
                          <Copy className="w-3 h-3 shrink-0 text-amber-800" />
                          <span className="truncate">{copiedKey === `tbl_${file.id}` ? 'Скопировано!' : displayPath}</span>
                        </button>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActivePreviewFile(file)}
                            className="p-1.5 bg-white hover:bg-stone-100 text-stone-900 rounded-lg transition border border-stone-300 shadow-sm"
                            title="Предпросмотр"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditFile(file)}
                            className="p-1.5 bg-white hover:bg-stone-100 text-stone-900 rounded-lg transition border border-stone-300 shadow-sm"
                            title="Редактировать"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setMovingFile(file); setTargetFolderId(file.folder_id); }}
                            className="p-1.5 bg-white hover:bg-stone-100 text-stone-900 rounded-lg transition border border-stone-300 shadow-sm"
                            title="Переместить"
                          >
                            <Folder className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setFileToDelete(file)}
                            className="p-1.5 bg-white hover:bg-red-50 text-red-700 rounded-lg transition border border-stone-300 shadow-sm"
                            title="Удалить файл"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal - File Preview */}
      <FilePreviewModal
        file={activePreviewFile}
        onClose={() => setActivePreviewFile(null)}
      />

      {/* Modal - Подтверждение удаления файла */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-stone-50/95 border border-stone-300 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 backdrop-blur-xl text-stone-900">
            <h3 className="text-lg font-bold text-red-700 font-gothic tracking-wide flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Подтверждение удаления файла</span>
            </h3>

            <div className="p-3 bg-white border border-stone-200 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg shrink-0 text-red-600">
                <FileText className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-stone-900 truncate">{fileToDelete.name}</p>
                <p className="text-[11px] font-mono text-stone-500">ID: {fileToDelete.id} • {formatBytes(fileToDelete.file_size)}</p>
              </div>
            </div>

            <p className="text-xs text-stone-700 leading-relaxed">
              Вы действительно хотите удалить этот файл? Запись будет окончательно удалена из таблицы <code className="bg-white px-1.5 py-0.5 border border-stone-300 rounded font-mono font-bold text-amber-900">file_storage</code> базы данных PostgreSQL.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition shadow-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFile}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                Да, удалить из БД
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Редактирование файла */}
      {fileToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-stone-50/95 border border-stone-300 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 backdrop-blur-xl text-stone-900">
            <h3 className="text-lg font-bold text-stone-900 font-gothic tracking-wide flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-800" />
              <span>Редактирование файла</span>
            </h3>

            <form onSubmit={handleConfirmEditFile} className="space-y-4">
              <div>
                <label className="text-xs text-stone-700 font-semibold mb-1 block">Название файла</label>
                <input
                  type="text"
                  required
                  value={editFileName}
                  onChange={(e) => setEditFileName(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-amber-800"
                />
              </div>

              <div>
                <label className="text-xs text-stone-700 font-semibold mb-1 block">Папка</label>
                <select
                  value={editFolderId === null ? 'null' : editFolderId}
                  onChange={(e) => setEditFolderId(e.target.value === 'null' ? null : Number(e.target.value))}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-amber-800"
                >
                  <option value="null">📁 Без папки (Корень)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-stone-700 font-semibold mb-1 block">MIME-тип</label>
                <input
                  type="text"
                  required
                  value={editMimeType}
                  onChange={(e) => setEditMimeType(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-800"
                />
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-900/20 rounded-xl space-y-1 text-xs">
                <span className="text-stone-600 font-semibold block">Красивая ссылка прокси:</span>
                <code className="text-amber-900 font-mono font-bold block truncate">
                  /file/{fileToEdit.id}/{formatFileNameForUrl(editFileName, editMimeType)}
                </code>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setFileToEdit(null)}
                  className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition shadow-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Подтверждение удаления папки */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-stone-50/95 border border-stone-300 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 backdrop-blur-xl text-stone-900">
            <h3 className="text-lg font-bold text-stone-900 font-gothic tracking-wide flex items-center gap-2">
              <Folder className="w-5 h-5 text-amber-800" />
              <span>Удаление папки</span>
            </h3>

            <p className="text-xs text-stone-700 leading-relaxed">
              Вы действительно хотите удалить папку <strong className="text-amber-900">{folderToDelete.name}</strong>? Файлы из этой папки не удалятся, а переместятся в корень («Без папки»).
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition shadow-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                Удалить папку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - New Folder */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
          <div className="bg-stone-50/95 border border-stone-300 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 backdrop-blur-xl text-stone-900">
            <h3 className="text-lg font-bold text-stone-900 font-gothic tracking-wide flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-amber-800" />
              <span>Создать новую папку</span>
            </h3>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="text-xs text-stone-700 font-semibold mb-1 block">Название папки</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Картинки Элементов"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-amber-800"
                />
              </div>

              <div>
                <label className="text-xs text-stone-700 font-semibold mb-1 block">Цвет метки папки</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newFolderColor}
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="w-10 h-10 rounded-lg bg-white border border-stone-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newFolderColor}
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="flex-1 bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono text-stone-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition shadow-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Создать папку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Move File */}
      {movingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
          <div className="bg-stone-50/95 border border-stone-300 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 backdrop-blur-xl text-stone-900">
            <h3 className="text-lg font-bold text-stone-900 font-gothic tracking-wide flex items-center gap-2">
              <MoveRight className="w-5 h-5 text-amber-800" />
              <span>Переместить файл</span>
            </h3>

            <p className="text-xs text-stone-800 truncate font-semibold bg-white p-2.5 rounded-xl border border-stone-300">
              📄 {movingFile.name}
            </p>

            <div className="space-y-2">
              <label className="text-xs text-stone-700 font-semibold block">Выберите папку назначения:</label>

              <button
                type="button"
                onClick={() => setTargetFolderId(null)}
                className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition ${
                  targetFolderId === null ? 'bg-amber-800 text-white border-amber-900 font-bold' : 'bg-white border-stone-300 text-stone-900 hover:bg-stone-100'
                }`}
              >
                <span>📁 Без папки (Корень)</span>
                {targetFolderId === null && <Check className="w-4 h-4" />}
              </button>

              {folders.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTargetFolderId(f.id)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition ${
                    targetFolderId === f.id ? 'bg-amber-800 text-white border-amber-900 font-bold' : 'bg-white border-stone-300 text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                    <span>{f.name}</span>
                  </div>
                  {targetFolderId === f.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setMovingFile(null)}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition shadow-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleMoveFile}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - ProTalk Token Settings */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
          <div className="bg-stone-50/95 border border-stone-300 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 backdrop-blur-xl text-stone-900">
            <h3 className="text-lg font-bold text-stone-900 font-gothic tracking-wide flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-800" />
              <span>Настройка токена ProTalk Upload</span>
            </h3>

            <p className="text-xs text-stone-700 leading-relaxed">
              Токен передается в заголовке <code className="text-amber-900 bg-white px-1 py-0.5 rounded font-mono border border-stone-300">X-Upload-Token</code> при загрузке на хостинг ProTalk.
            </p>

            <div>
              <label className="text-xs text-stone-700 font-semibold mb-1 block">X-Upload-Token</label>
              <textarea
                rows={3}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-3 text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-800"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setTokenInput(DEFAULT_TOKEN)}
                className="text-xs text-stone-600 hover:text-amber-900 underline transition"
              >
                Сбросить на дефолтный токен
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTokenModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition shadow-sm"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={saveToken}
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Сохранить токен
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
