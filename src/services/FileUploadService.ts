// FileUploadService.ts - ProTalk Gallery & File Store Service

export interface FileRecord {
  id: number;
  file_key: string;
  name: string;
  original_url: string;
  short_url: string;
  mime_type: string;
  file_size: number;
  folder_id: number | null;
  created_at: string;
}

export interface FileFolder {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface FileMap {
  [key: string]: string; // key -> полный URL (или короткий локальный URL)
}

export const UPLOAD_URL = "https://file.pro-talk.ru/tgf";
export const FILESTORE_UP_URL = "https://filestore.pro-talk.ru/up";
export const STORAGE_KEY = "protalk_upload_token";
export const FILES_MAP_KEY = "protalk_files_map";
export const DEFAULT_TOKEN = "b2VcU3NrVVttYlh3GHM_AEQ4eA8yDR4FGREODwsaLyUqQjpTEA8HGzMdFB8aORQYaG9dWGpkVQRvAXM";

export class FileUploadService {
  private token: string;

  constructor(token?: string) {
    this.token = token || this.getToken();
  }

  public getToken(): string {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || DEFAULT_TOKEN;
  }

  public setToken(token: string): void {
    this.token = token;
    localStorage.setItem(STORAGE_KEY, token);
  }

  // Загрузка по URL через ProTalk
  async uploadFromUrl(url: string): Promise<string> {
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        "X-Upload-Token": this.token
      },
      body: new URLSearchParams({ url })
    });

    if (!response.ok) throw new Error("Ошибка загрузки по URL");
    const data = await response.json();
    return data.url || data.file_url || data.link;
  }

  // Загрузка из File с поддержкой прозрачности PNG (X-Preserve-Alpha)
  async uploadFromFile(file: File, preserveAlpha = true): Promise<string> {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const headers: Record<string, string> = {
      "X-Upload-Token": this.token,
      "X-Preserve-Alpha": "true"
    };

    // Всегда используем основной хостинг filestore.pro-talk.ru/up
    const targetUrl = FILESTORE_UP_URL;

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: formData
      });

      if (!response.ok) {
        // Резервный фоллбэк на UPLOAD_URL с сохраненным токеном
        const fallbackResponse = await fetch(UPLOAD_URL, {
          method: "POST",
          headers: { 
            "X-Upload-Token": this.token,
            "X-Preserve-Alpha": "true"
          },
          body: formData
        });
        if (!fallbackResponse.ok) {
          const errText = await fallbackResponse.text();
          throw new Error(errText || "Не удалось загрузить файл на ProTalk FileStore");
        }
        const fbData = await fallbackResponse.json();
        return fbData.url || fbData.file_url || fbData.link;
      }

      const data = await response.json();
      return data.url || data.file_url || data.link;
    } catch (err) {
      console.warn("Primary filestore upload attempt failed, trying fallback...", err);
      // Повторная попытка
      const fallbackResponse = await fetch(UPLOAD_URL, {
        method: "POST",
        headers: { 
          "X-Upload-Token": this.token,
          "X-Preserve-Alpha": "true"
        },
        body: formData
      });
      if (!fallbackResponse.ok) throw new Error("Не удалось загрузить файл на ProTalk FileStore");
      const fbData = await fallbackResponse.json();
      return fbData.url || fbData.file_url || fbData.link;
    }
  }

  // Загрузка из Blob
  async uploadFromBlob(blob: Blob, filename: string): Promise<string> {
    const file = new File([blob], filename, { type: blob.type });
    return this.uploadFromFile(file);
  }

  // Загрузка из base64
  async uploadFromBase64(base64: string, filename: string): Promise<string> {
    const response = await fetch(base64);
    const blob = await response.blob();
    return this.uploadFromBlob(blob, filename);
  }

  // Массовая загрузка нескольких файлов
  async uploadBatch(
    files: File[], 
    folderId?: number | null,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<FileRecord[]> {
    const results: FileRecord[] = [];
    let completed = 0;

    for (const file of files) {
      const originalUrl = await this.uploadFromFile(file);
      
      // Регистрируем файл в локальном бэкенде галереи
      const res = await fetch("/api/admin/files/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          original_url: originalUrl,
          mime_type: file.type || 'application/octet-stream',
          file_size: file.size,
          folder_id: folderId || null
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Ошибка регистрации файла на сервере");
      }

      const registeredFile = await res.json();
      results.push(registeredFile);

      completed++;
      if (onProgress) onProgress(completed, files.length);
    }

    return results;
  }

  // Генерация 8-символьного ключа
  generateKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Замена плейсхолдеров {{key}} на URL
  replaceKeysWithUrls(text: string, map: FileMap): string {
    let result = text;
    for (const [key, url] of Object.entries(map)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), url);
    }
    return result;
  }

  // Замена URL на плейсхолдеры {{key}}
  replaceUrlsWithKeys(text: string, map: FileMap): string {
    let result = text;
    for (const [key, url] of Object.entries(map)) {
      result = result.replace(new RegExp(url, 'g'), `{{${key}}}`);
    }
    return result;
  }
}

let uploadService: FileUploadService | null = null;
export function getUploadService(): FileUploadService {
  if (!uploadService) {
    uploadService = new FileUploadService();
  }
  return uploadService;
}
