/** Geometry for the upload crop box. Viewport pixels, origin at the top left. */

export function coverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewWidth: number,
  viewHeight: number
) {
  return Math.max(viewWidth / naturalWidth, viewHeight / naturalHeight);
}

export function clampPan(
  panX: number,
  panY: number,
  displayedWidth: number,
  displayedHeight: number,
  viewWidth: number,
  viewHeight: number
) {
  const maxX = Math.max(0, (displayedWidth - viewWidth) / 2);
  const maxY = Math.max(0, (displayedHeight - viewHeight) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, panX)),
    y: Math.min(maxY, Math.max(-maxY, panY)),
  };
}

/**
 * Visible source rectangle in the original image, plus where to paint the
 * image inside the crop frame. Zoom 1 is the tightest cover fit.
 */
export function cropFrame(
  naturalWidth: number,
  naturalHeight: number,
  viewWidth: number,
  viewHeight: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const scale = coverScale(naturalWidth, naturalHeight, viewWidth, viewHeight) * zoom;
  const displayedWidth = naturalWidth * scale;
  const displayedHeight = naturalHeight * scale;
  const pan = clampPan(
    panX,
    panY,
    displayedWidth,
    displayedHeight,
    viewWidth,
    viewHeight
  );
  const imageLeft = (viewWidth - displayedWidth) / 2 + pan.x;
  const imageTop = (viewHeight - displayedHeight) / 2 + pan.y;
  return {
    pan,
    displayedWidth,
    displayedHeight,
    imageLeft,
    imageTop,
    sx: (0 - imageLeft) / scale,
    sy: (0 - imageTop) / scale,
    sw: viewWidth / scale,
    sh: viewHeight / scale,
  };
}
