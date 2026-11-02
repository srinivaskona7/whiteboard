// tools/image.js
import { uid, createElement } from '../scene/model.js';

export async function insertImageFile(app, file, worldPos = null) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return insertImageDataUrl(app, dataUrl, worldPos);
}

export async function insertImageDataUrl(app, rawDataUrl, worldPos = null) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = rawDataUrl;
  });

  const maxDim = 1400;
  let natW = img.naturalWidth || 300;
  let natH = img.naturalHeight || 200;
  let finalDataUrl = rawDataUrl;
  if (natW > maxDim || natH > maxDim) {
    const scale = Math.min(maxDim / natW, maxDim / natH);
    natW = Math.round(natW * scale);
    natH = Math.round(natH * scale);
    const off = document.createElement('canvas');
    off.width = natW;
    off.height = natH;
    off.getContext('2d').drawImage(img, 0, 0, natW, natH);
    finalDataUrl = off.toDataURL('image/png', 0.9);
  }

  const fileId = uid('file');
  app.scene.files[fileId] = {
    id: fileId,
    dataUrl: finalDataUrl,
    width: natW,
    height: natH,
    created: Date.now(),
  };

  const dispScale = Math.min(1, 360 / Math.max(natW, natH));
  const w = Math.round(natW * dispScale);
  const h = Math.round(natH * dispScale);
  const pt = worldPos || app.getViewportCenterWorld();
  const page = app.getPage();
  const el = createElement('image', {
    fileId,
    x: Math.round(pt.x - w / 2),
    y: Math.round(pt.y - h / 2),
    w,
    h,
    naturalWidth: natW,
    naturalHeight: natH,
    lockAspectRatio: true,
  });
  page.elements.push(el);
  app.selectedIds = new Set([el.id]);
  app.commitChange();
  app.updateUI();
  app.requestRender();
  return el;
}

export function toggleImageCrop(app, imgEl) {
  if (!app.cropState) {
    app.cropState = {
      element: imgEl,
      rect: {
        x: imgEl.x + imgEl.w * 0.1,
        y: imgEl.y + imgEl.h * 0.1,
        w: imgEl.w * 0.8,
        h: imgEl.h * 0.8,
      },
    };
    app.dialogs.showToast('Drag inside image to adjust crop, then click "Apply Crop".', 'info');
  } else {
    const { element, rect } = app.cropState;
    const rx = Math.max(0, Math.min(0.95, (rect.x - element.x) / element.w));
    const ry = Math.max(0, Math.min(0.95, (rect.y - element.y) / element.h));
    const rw = Math.max(0.05, Math.min(1 - rx, rect.w / element.w));
    const rh = Math.max(0.05, Math.min(1 - ry, rect.h / element.h));
    element.crop = { x: rx, y: ry, w: rw, h: rh };
    element.x = rect.x;
    element.y = rect.y;
    element.w = rect.w;
    element.h = rect.h;
    app.cropState = null;
    app.commitChange();
  }
  app.updateUI();
  app.requestRender();
}

export function toggleImageBackgroundLock(app, imgEl) {
  imgEl.isBackground = !imgEl.isBackground;
  imgEl.locked = imgEl.isBackground;
  if (imgEl.locked) {
    app.selectedIds.delete(imgEl.id);
    app.dialogs.showToast('Image locked as background. Unlock from Layers panel.', 'info');
  }
  app.commitChange();
  app.updateUI();
  app.requestRender();
}
