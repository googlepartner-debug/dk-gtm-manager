// Screenshots are stored as base64 in localStorage (no backend, PRD §7) — a raw phone/retina
// screenshot easily runs 3-5 MB, which would blow through localStorage's ~5-10 MB per-origin
// quota after a handful of events. Downscale + re-encode as JPEG client-side before storing.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

export function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D non disponible')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image illisible')); };
    img.src = objectUrl;
  });
}
