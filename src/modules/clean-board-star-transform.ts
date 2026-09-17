import { gsap } from 'gsap';

export function freezeCleanBoardStarRenderedScale(star: HTMLElement): number {
  const renderedTransform = window.getComputedStyle(star).transform;
  let renderedScale = 1;
  const matrix = renderedTransform.match(/^matrix\(([^)]+)\)$/);
  const matrix3d = renderedTransform.match(/^matrix3d\(([^)]+)\)$/);
  if (matrix) {
    const values = matrix[1].split(',').map(Number);
    renderedScale = Math.hypot(values[0] || 0, values[1] || 0) || 1;
  } else if (matrix3d) {
    const values = matrix3d[1].split(',').map(Number);
    renderedScale = Math.hypot(values[0] || 0, values[1] || 0, values[2] || 0) || 1;
  } else {
    const gsapScale = Number(gsap.getProperty(star, 'scale'));
    if (Number.isFinite(gsapScale) && gsapScale > 0) renderedScale = gsapScale;
  }

  // CSS owns transform while the Star breathes. Hand its exact rendered pose
  // to GSAP before releasing that owner, so exit cannot flash back to 0.88.
  star.style.animation = 'none';
  gsap.set(star, { scale: renderedScale, transformOrigin: 'center center' });
  return renderedScale;
}
