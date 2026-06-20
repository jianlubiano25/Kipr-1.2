/**
 * Resizes an image file to a maximum width/height while maintaining aspect ratio.
 * Returns a Promise that resolves with the base64 data URL of the resized image.
 */
export const resizeImage = (file, maxW = 1600, maxH = 1600) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = e => {
    const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); let w = img.width, h = img.height;
      if (w > h) { if (w > maxW) { h *= maxW / w; w = maxW; } } else { if (h > maxH) { w *= maxH / h; h = maxH; } }
      c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = rej; img.src = e.target.result;
  };
  r.onerror = rej; r.readAsDataURL(file);
});