import defaultLogoUrl from '../assets/images/ditjenpas_protokol_emblem_1795653442369.jpg';

const CUSTOM_LOGO_STORAGE_KEY = 'subag_tu_pim_custom_logo_v1';

export const DEFAULT_APP_LOGO: string = defaultLogoUrl;

export function getStoredCustomLogo(): string | null {
  try {
    const saved = localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY);
    return saved && saved.startsWith('data:image/') ? saved : null;
  } catch {
    return null;
  }
}

export function getActiveAppLogo(): string {
  return getStoredCustomLogo() || DEFAULT_APP_LOGO;
}

export function saveCustomLogo(dataUrl: string): void {
  try {
    localStorage.setItem(CUSTOM_LOGO_STORAGE_KEY, dataUrl);
  } catch (err) {
    console.warn('Gagal menyimpan logo kustom ke localStorage:', err);
  }
}

export function resetCustomLogo(): void {
  try {
    localStorage.removeItem(CUSTOM_LOGO_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function updateDocumentFavicon(logoSrc: string): void {
  if (typeof document === 'undefined' || !logoSrc) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = logoSrc;
}

/**
 * Resizes an uploaded logo image to a crisp square-friendly PNG data URL (max 512px)
 * so it stays fast, crisp in header/print/PDF, and safely fits in browser storage.
 */
export function normalizeUploadedLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const rawUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Berkas bukan gambar yang valid.'));
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts the active logo URL (bundled Vite asset or custom data URL) into a PNG data URL
 * compatible with jsPDF.addImage() for crisp institutional Kop Surat PDF rendering.
 */
export function resolveLogoDataUrlForPdf(logoSrc: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!logoSrc) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, size, size);
        const ratio = Math.min(size / img.width, size / img.height);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        const dx = (size - drawW) / 2;
        const dy = (size - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = logoSrc;
  });
}
