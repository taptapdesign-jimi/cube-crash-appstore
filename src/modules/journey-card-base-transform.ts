// @ts-nocheck
import { gsap } from 'gsap';

const JOURNEY_CARD_BASE_TRANSFORM_KEY = '__ccJourneyBaseTransform';

function formatTransformNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function isJourneyBoardCardWrapper(target: HTMLElement | null | undefined): target is HTMLElement {
  return !!target && target.classList.contains('journey-board-card-wrapper');
}

function getStoredJourneyBoardCardBaseTransform(target: HTMLElement | null | undefined): string {
  if (!isJourneyBoardCardWrapper(target)) return '';

  const anyTarget = target as any;
  const stored = anyTarget[JOURNEY_CARD_BASE_TRANSFORM_KEY];
  if (typeof stored === 'string' && stored.trim()) return stored;

  const datasetTransform = target.dataset?.journeyBaseTransform;
  if (typeof datasetTransform === 'string' && datasetTransform.trim()) return datasetTransform;

  return '';
}

function getInlineRotationDegrees(transform: string): number | null {
  const rotateMatch = transform.match(/rotate\(([-\d.]+)(deg|rad)?\)/);
  if (rotateMatch) {
    const raw = Number(rotateMatch[1]);
    if (!Number.isFinite(raw)) return null;
    return rotateMatch[2] === 'rad' ? raw * (180 / Math.PI) : raw;
  }

  const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map((value) => Number(value.trim()));
    if (values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1])) {
      return Math.atan2(values[1], values[0]) * (180 / Math.PI);
    }
  }

  const matrix3dMatch = transform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map((value) => Number(value.trim()));
    if (values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1])) {
      return Math.atan2(values[1], values[0]) * (180 / Math.PI);
    }
  }

  return null;
}

function getInlineScale(transform: string): number | null {
  const scaleMatch = transform.match(/scale\(([-\d.]+)/);
  if (scaleMatch) {
    const value = Number(scaleMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  const scale3dMatch = transform.match(/scale3d\(([-\d.]+)/);
  if (scale3dMatch) {
    const value = Number(scale3dMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map((value) => Number(value.trim()));
    if (values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1])) {
      return Math.sqrt((values[0] * values[0]) + (values[1] * values[1]));
    }
  }

  const matrix3dMatch = transform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map((value) => Number(value.trim()));
    if (values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1])) {
      return Math.sqrt((values[0] * values[0]) + (values[1] * values[1]));
    }
  }

  return null;
}

function getCenteredTranslatePrefix(transform: string): string {
  const calcMatch = transform.match(/translateX\(calc\([^)]+\)\)/);
  if (calcMatch) return `${calcMatch[0]} `;

  const translateXMatch = transform.match(/translateX\(-?[\d.]+%\)/);
  if (translateXMatch) return `${translateXMatch[0]} `;

  return '';
}

function normalizeJourneyBoardCardTransform(transform: string): string {
  const rotation = getInlineRotationDegrees(transform);
  if (rotation === null) return '';

  const rawScale = getInlineScale(transform);
  const scale = rawScale !== null && rawScale > 1.2 ? rawScale : 1;
  const prefix = getCenteredTranslatePrefix(transform);
  return `${prefix}rotate(${formatTransformNumber(rotation)}deg) scale(${formatTransformNumber(scale)})`;
}

export function getJourneyBoardCardBaseTransform(target: HTMLElement | null | undefined): string {
  if (!isJourneyBoardCardWrapper(target)) return '';

  const storedTransform = getStoredJourneyBoardCardBaseTransform(target);
  if (storedTransform.trim()) return storedTransform;

  const anyTarget = target as any;
  const originalTransform = anyTarget._originalTransform;
  if (typeof originalTransform === 'string' && originalTransform.trim()) {
    const normalized = normalizeJourneyBoardCardTransform(originalTransform);
    return normalized || originalTransform;
  }

  const inlineTransform = target.style.transform || '';
  return normalizeJourneyBoardCardTransform(inlineTransform);
}

export function setJourneyBoardCardBaseTransform(
  target: HTMLElement | null | undefined,
  transform: string
): void {
  if (!isJourneyBoardCardWrapper(target)) return;
  const normalized = normalizeJourneyBoardCardTransform(transform);
  if (!normalized.trim()) return;

  const anyTarget = target as any;
  anyTarget[JOURNEY_CARD_BASE_TRANSFORM_KEY] = normalized;
  anyTarget._originalTransform = normalized;
  target.dataset.journeyBaseTransform = normalized;
}

export function rememberJourneyBoardCardBaseTransform(target: HTMLElement | null | undefined): void {
  if (!isJourneyBoardCardWrapper(target)) return;
  if (getStoredJourneyBoardCardBaseTransform(target).trim()) return;
  setJourneyBoardCardBaseTransform(target, target.style.transform || '');
}

export function restoreJourneyBoardCardBaseTransform(target: HTMLElement | null | undefined): void {
  if (!isJourneyBoardCardWrapper(target)) return;
  const baseTransform = getJourneyBoardCardBaseTransform(target);
  if (!baseTransform.trim()) return;

  const rotation = getInlineRotationDegrees(baseTransform) ?? 0;
  const scale = getInlineScale(baseTransform) ?? 1;
  const centeredPrefix = getCenteredTranslatePrefix(baseTransform);

  try { gsap.killTweensOf(target); } catch {}
  try {
    gsap.set(target, { clearProps: 'transform' });
  } catch {
    target.style.removeProperty('transform');
  }
  try {
    gsap.set(target, {
      x: 0,
      y: 0,
      rotation,
      scale,
      force3D: false,
      transformOrigin: 'center center',
    });
    if (centeredPrefix) {
      target.style.transform = baseTransform;
    }
  } catch {
    target.style.transform = baseTransform;
    target.style.transformOrigin = 'center center';
  }
}

export function getJourneyBoardCardBaseRotationDegrees(target: HTMLElement | null | undefined): number {
  const rotation = getInlineRotationDegrees(getJourneyBoardCardBaseTransform(target));
  return rotation === null ? 0 : rotation;
}

export function getJourneyBoardCardBaseScale(target: HTMLElement | null | undefined): number {
  const scale = getInlineScale(getJourneyBoardCardBaseTransform(target));
  return scale === null || scale <= 0 ? 1 : scale;
}
