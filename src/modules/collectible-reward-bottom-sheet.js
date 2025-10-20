// Collectible Reward Bottom Sheet
// Displays a bottom sheet when a new collectible card is unlocked.

let activeOverlay = null;
let activeResolve = null;
let activeCleanupFns = [];
let isClosing = false;

function registerCleanup(fn) {
  if (typeof fn === 'function') {
    activeCleanupFns.push(fn);
  }
}

function cleanupOverlay() {
  const fns = activeCleanupFns.splice(0);
  fns.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.warn('⚠️ Collectible reward cleanup failed:', error);
    }
  });
}

function buildMarkup(detail) {
  const { cardName, imagePath } = detail;

  return `
    <div class="modal-handle" aria-hidden="true"></div>
    <div class="collectible-reward-body">
      <div class="collectible-reward-header">
        <h2 class="collectible-reward-title">
          <span class="collectible-reward-title-emphasis">NEW</span>
          <span>Reward</span>
        </h2>
        <p class="collectible-reward-subtitle">Congrats! You unlocked a new collectible card.</p>
      </div>
      <div class="collectible-reward-card-wrapper" role="presentation">
        <div
          class="collectible-reward-card"
          style="background-image: url('${imagePath || ''}');"
          role="img"
          aria-label="${cardName || 'Unlocked collectible card'}"
        ></div>
      </div>
    </div>
    <button class="collectible-reward-cta continue-btn" type="button">
      Collect Reward
    </button>
  `;
}

function attachDragHandlers(sheet) {
  let startY = 0;
  let pointerId = null;
  let dragging = false;

  const threshold = 90;
  const maxDelta = 160;

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.collectible-reward-cta')) return;
    if (isClosing) return;

    dragging = true;
    pointerId = event.pointerId;
    startY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
    sheet.style.transition = 'none';

    try {
      sheet.setPointerCapture(pointerId);
    } catch {}
  };

  const onPointerMove = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? startY;
    const delta = Math.min(Math.max(0, clientY - startY), maxDelta);
    sheet.style.transform = `translateY(${delta}px)`;
  };

  const finishDrag = (event, shouldDismiss) => {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    const clientY = event.clientY ?? startY;
    const delta = Math.max(0, clientY - startY);

    try {
      sheet.releasePointerCapture(pointerId);
    } catch {}
    pointerId = null;

    requestAnimationFrame(() => {
      sheet.style.transition = '';
    });

    if (shouldDismiss || delta > threshold) {
      hideCollectibleRewardBottomSheet('drag-dismiss', { preserveCurrentTransform: true });
    } else {
      sheet.style.transform = '';
    }
  };

  const onPointerUp = (event) => finishDrag(event, false);
  const onPointerCancel = (event) => finishDrag(event, false);
  const onPointerLeave = (event) => {
    if (dragging && event.pointerId === pointerId) {
      finishDrag(event, false);
    }
  };

  sheet.addEventListener('pointerdown', onPointerDown);
  sheet.addEventListener('pointermove', onPointerMove);
  sheet.addEventListener('pointerup', onPointerUp);
  sheet.addEventListener('pointercancel', onPointerCancel);
  sheet.addEventListener('pointerleave', onPointerLeave);

  registerCleanup(() => {
    sheet.removeEventListener('pointerdown', onPointerDown);
    sheet.removeEventListener('pointermove', onPointerMove);
    sheet.removeEventListener('pointerup', onPointerUp);
    sheet.removeEventListener('pointercancel', onPointerCancel);
    sheet.removeEventListener('pointerleave', onPointerLeave);
  });
}

function lockInteractions() {
  document.documentElement.classList.add('collectible-reward-open');
}

function unlockInteractions() {
  document.documentElement.classList.remove('collectible-reward-open');
}

export function hideCollectibleRewardBottomSheet(reason = 'dismiss', options = {}) {
  if (!activeOverlay || isClosing) {
    if (typeof options.onAfterClose === 'function') {
      options.onAfterClose();
    }
    return;
  }

  const overlay = activeOverlay;
  const sheet = overlay.querySelector('.collectible-reward-bottom-sheet');
  const { preserveCurrentTransform = false, onAfterClose } = options;

  isClosing = true;
  overlay.classList.remove('visible');
  overlay.classList.add('closing');

  if (!preserveCurrentTransform) {
    sheet.style.transform = '';
  }
  sheet.classList.remove('visible');
  if (preserveCurrentTransform) {
    sheet.style.transition = 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    requestAnimationFrame(() => {
      sheet.style.transform = 'translateY(100%)';
    });
  }

  setTimeout(() => {
    cleanupOverlay();

    try {
      overlay.remove();
    } catch {}

    unlockInteractions();

    if (typeof window.unlockSlider === 'function') {
      try {
        window.unlockSlider();
      } catch (error) {
        console.warn('⚠️ Failed to unlock slider after reward sheet:', error);
      }
    }

    activeOverlay = null;
    isClosing = false;

    if (typeof onAfterClose === 'function') {
      try {
        onAfterClose();
      } catch (error) {
        console.warn('⚠️ Reward sheet onAfterClose failed:', error);
      }
    }

    if (typeof activeResolve === 'function') {
      const resolveFn = activeResolve;
      activeResolve = null;
      resolveFn(reason);
    }
  }, 360);
}

export function showCollectibleRewardBottomSheet(detail = {}) {
  if (!detail || !detail.imagePath) {
    console.warn('⚠️ Missing collectible detail, skipping reward sheet.');
    return Promise.resolve('skipped');
  }

  if (activeOverlay) {
    console.warn('⚠️ Collectible reward sheet already open, ignoring duplicate request.');
    return Promise.resolve('duplicate');
  }

  const overlay = document.createElement('div');
  overlay.className = 'collectible-reward-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'collectible-reward-bottom-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Collectible unlocked');
  sheet.innerHTML = buildMarkup(detail);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  activeOverlay = overlay;
  activeCleanupFns = [];
  isClosing = false;

  lockInteractions();

  const cta = sheet.querySelector('.collectible-reward-cta');
  if (cta) {
    const handleCtaClick = () => {
      hideCollectibleRewardBottomSheet('cta', {
        onAfterClose: () => {
          if (window.collectiblesManager && typeof window.collectiblesManager.showCollectibles === 'function') {
            window.collectiblesManager.showCollectibles();
          } else if (typeof window.showCollectibles === 'function') {
            window.showCollectibles();
          }
        }
      });
    };

    cta.addEventListener('click', handleCtaClick);

    registerCleanup(() => {
      cta.removeEventListener('click', handleCtaClick);
    });
  }

  const handleOverlayClick = (event) => {
    if (event.target === overlay) {
      hideCollectibleRewardBottomSheet('backdrop');
    }
  };

  overlay.addEventListener('click', handleOverlayClick);
  registerCleanup(() => {
    overlay.removeEventListener('click', handleOverlayClick);
  });

  attachDragHandlers(sheet);

  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  });

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}
