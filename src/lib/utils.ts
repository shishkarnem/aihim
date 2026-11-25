import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
  'я': 'ya',
  'А': 'a', 'Б': 'b', 'В': 'v', 'Г': 'g', 'Д': 'd', 'Е': 'e', 'Ё': 'yo', 'Ж': 'zh',
  'З': 'z', 'И': 'i', 'Й': 'y', 'К': 'k', 'Л': 'l', 'М': 'm', 'Н': 'n', 'О': 'o',
  'П': 'p', 'Р': 'r', 'С': 's', 'Т': 't', 'У': 'u', 'Ф': 'f', 'Х': 'h', 'Ц': 'ts',
  'Ч': 'ch', 'Ш': 'sh', 'Щ': 'sch', 'Ъ': '', 'Ы': 'y', 'Ь': '', 'Э': 'e', 'Ю': 'yu',
  'Я': 'ya'
};

export function transliterate(str: string): string {
  return str.split('').map(c => CYRILLIC_TO_LATIN[c] ?? c).join('');
}

export function formatFileNameForUrl(originalName: string, mimeType?: string): string {
  if (!originalName) originalName = 'file';

  const lastDotIndex = originalName.lastIndexOf('.');
  let namePart = originalName;
  let extPart = '';

  if (lastDotIndex > 0) {
    namePart = originalName.slice(0, lastDotIndex);
    extPart = originalName.slice(lastDotIndex).toLowerCase();
  }

  if (!extPart && mimeType) {
    if (mimeType.includes('png')) extPart = '.png';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extPart = '.jpg';
    else if (mimeType.includes('gif')) extPart = '.gif';
    else if (mimeType.includes('svg')) extPart = '.svg';
    else if (mimeType.includes('webp')) extPart = '.webp';
    else if (mimeType.includes('pdf')) extPart = '.pdf';
    else if (mimeType.includes('mp3')) extPart = '.mp3';
    else if (mimeType.includes('mp4')) extPart = '.mp4';
  }

  let latinName = transliterate(namePart).toLowerCase();
  // Заменяем пробелы и спецсимволы на нижнее подчеркивание
  latinName = latinName.replace(/\s+/g, '_');
  latinName = latinName.replace(/[^a-z0-9_\-]/g, '_');
  latinName = latinName.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  if (!latinName) latinName = 'file';

  return `${latinName}${extPart}`;
}

export function getShortFileUrl(fileIdOrKey: string | number, fileName?: string, mimeType?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!fileName) return `${origin}/file/${fileIdOrKey}`;
  const formattedName = formatFileNameForUrl(fileName, mimeType);
  return `${origin}/file/${fileIdOrKey}/${formattedName}`;
}

