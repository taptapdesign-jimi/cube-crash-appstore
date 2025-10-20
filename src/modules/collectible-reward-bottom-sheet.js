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
  const { cardName, imagePath, rarity } = detail;
  const rarityLabel = (rarity || 'Common').toUpperCase();
  const rarityLower = (rarity || 'Common').toLowerCase();
  const backImage = './assets/colelctibles/common back.png';

  return `
    <div class="modal-handle" aria-hidden="true"></div>
    <div class="collectible-reward-body" data-rarity="${rarityLower}">
      <h2 class="collectible-reward-title">
        <span class="collectible-reward-title-new">NEW</span>
        <span class="collectible-reward-title-label">Reward</span>
      </h2>
      <p class="collectible-reward-subtitle" data-state="hidden" aria-live="polite">
        <span>Congrats! Tap to reveal the</span>
        <span>collectible reward</span>
      </p>
      <div class="collectible-reward-card-wrapper" role="presentation">
        <div class="collectible-reward-card-container" data-state="hidden" role="button" tabindex="0" aria-label="Reveal collectible card">
          <div class="collectible-reward-card-face collectible-reward-card-back" style="background-image: url('${backImage}');"></div>
          <div class="collectible-reward-card-face collectible-reward-card-front" style="background-image: url('${imagePath || ''}');" aria-label="${cardName || 'Unlocked collectible card'}"></div>
          <div class="collectible-reward-card-smoke"></div>
          <div class="collectible-reward-card-sparkles"></div>
          <div class="collectible-reward-card-shimmer"></div>
          <div class="collectible-reward-card-puff"></div>
        </div>
      </div>
    </div>
    <button class="collectible-reward-cta continue-btn reveal-btn" type="button" aria-live="polite">
      Reveal
    </button>
  `;
}

function attachDragHandlers(sheet) {
  let startY = 0;
  let pointerId = null;
  let dragging = false;

  const threshold = 50;
  const maxDelta = 1000; // Allow dragging much further down

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
    const delta = Math.max(0, clientY - startY); // Remove maxDelta limit for free dragging
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
  const {
    preserveCurrentTransform = false,
    onAfterClose,
    duration = 360,
    easing = preserveCurrentTransform ? 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'cubic-bezier(0.23, 0.82, 0.28, 1)'
  } = options;

  isClosing = true;
  overlay.classList.remove('visible');
  overlay.classList.add('closing');

  const cleanupInlineTransitions = () => {
    try {
      sheet.style.transition = '';
    } catch {}
    try {
      overlay.style.transition = '';
    } catch {}
  };

  overlay.style.transition = `opacity ${Math.min(duration, 1200)}ms ease-in-out`;

  sheet.classList.remove('visible');
  if (preserveCurrentTransform) {
    sheet.style.transition = `transform ${duration}ms ${easing}`;
    requestAnimationFrame(() => {
      sheet.style.transform = 'translateY(100%)';
    });
  } else {
    requestAnimationFrame(() => {
      sheet.style.transition = `transform ${duration}ms ${easing}`;
      sheet.style.transform = 'translateY(100%)';
    });
  }

  setTimeout(() => {
    cleanupOverlay();
    cleanupInlineTransitions();

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
  }, duration);
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
  const performCollect = () => {
    hideCollectibleRewardBottomSheet('collect', {
      duration: 3750,
      easing: 'ease-out'
    });
    requestAnimationFrame(() => {
      if (typeof window.ensureDotsVisible === 'function') {
        try { window.ensureDotsVisible(); } catch {}
      }
    });
  };

  if (cta) {
    const handleCtaClick = () => {
      if (sheet.dataset.revealed === '1') {
        performCollect();
      } else {
        revealCollectibleCard(sheet, detail);
      }
    };

    cta.addEventListener('click', handleCtaClick);

    registerCleanup(() => {
      cta.removeEventListener('click', handleCtaClick);
    });
  }

  const cardContainer = sheet.querySelector('.collectible-reward-card-container');
  if (cardContainer) {
    const handleCardClick = () => {
      if (sheet.dataset.revealed === '1') {
        performCollect();
        return;
      }
      revealCollectibleCard(sheet, detail);
    };
    const handleCardKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (sheet.dataset.revealed === '1') {
          performCollect();
          return;
        }
        revealCollectibleCard(sheet, detail);
      }
    };
    cardContainer.addEventListener('click', handleCardClick);
    cardContainer.addEventListener('keydown', handleCardKeyDown);
    registerCleanup(() => {
      cardContainer.removeEventListener('click', handleCardClick);
      cardContainer.removeEventListener('keydown', handleCardKeyDown);
    });
  }

  const handleOverlayClick = (event) => {
    if (event.target === overlay) {
      hideCollectibleRewardBottomSheet('backdrop', {
        duration: 1500,
        easing: 'ease-out'
      });
    }
  };

  // Add outside click functionality with delay like resume game
  setTimeout(() => {
    const handleOutsideClick = (e) => {
      if (overlay && !overlay.contains(e.target)) {
        hideCollectibleRewardBottomSheet('backdrop', {
          duration: 1500,
          easing: 'ease-out'
        });
      }
    };
    
    const handleOutsideTouch = (e) => {
      if (overlay && !overlay.contains(e.target)) {
        hideCollectibleRewardBottomSheet('backdrop', {
          duration: 1500,
          easing: 'ease-out'
        });
      }
    };
    
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('touchend', handleOutsideTouch);
    
    registerCleanup(() => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('touchend', handleOutsideTouch);
    });
  }, 200); // Same delay as resume game

  attachDragHandlers(sheet);

  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  });

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

function revealCollectibleCard(sheet, detail) {
  if (sheet.dataset.revealing === '1') return;
  sheet.dataset.revealing = '1';

  const cardContainer = sheet.querySelector('.collectible-reward-card-container');
  const cardFront = sheet.querySelector('.collectible-reward-card-front');
  const cardBack = sheet.querySelector('.collectible-reward-card-back');
  const puff = sheet.querySelector('.collectible-reward-card-puff');
  const cta = sheet.querySelector('.collectible-reward-cta');
  const title = sheet.querySelector('.collectible-reward-title');
  const subtitle = sheet.querySelector('.collectible-reward-subtitle');
  const rarity = (sheet.querySelector('.collectible-reward-body')?.dataset.rarity || 'common');
  const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);

  if (cta) {
    cta.disabled = true;
    cta.classList.add('revealing');
    cta.textContent = 'Revealing...';
    cta.setAttribute('aria-live', 'assertive');
  }

  if (cardContainer) {
    cardContainer.classList.add('revealing');
    cardContainer.dataset.state = 'revealing';
  }

  const TEXT_FADE_OUT_MS = 500;
  const TEXT_FADE_IN_MS = 500;
  const TEXT_DELAY_MS = 600; // Reduced delay to prevent double animation

  // Start card rotation immediately
  requestAnimationFrame(() => {
    if (cardBack) {
      cardBack.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease';
      cardBack.style.transform = 'rotateY(-180deg)';
      cardBack.style.opacity = '0';
    }
    if (cardFront) {
      cardFront.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease';
      cardFront.style.transform = 'rotateY(0deg)';
      cardFront.style.opacity = '1';
    }
  });

  if (puff) {
    puff.style.opacity = '0';
  }

  // Start text fade out immediately
  [title, subtitle].forEach((node) => {
    if (!node) return;
    node.classList.remove('collectible-reward-text-fade-out', 'collectible-reward-text-fade-in');
    node.offsetHeight;
    node.classList.add('collectible-reward-text-fade-out');
    setTimeout(() => node.classList.remove('collectible-reward-text-fade-out'), TEXT_FADE_OUT_MS);
  });

  // Change text after fade out completes
  setTimeout(() => {
    if (title) {
      title.innerHTML = `<span class="collectible-reward-title-label">${rarityLabel}</span>`;
      title.offsetHeight;
      title.classList.add('collectible-reward-text-fade-in');
      setTimeout(() => title.classList.remove('collectible-reward-text-fade-in'), TEXT_FADE_IN_MS);
    }
    if (subtitle) {
      subtitle.dataset.state = 'revealed';
      subtitle.innerHTML = `
        <span>You unlocked the</span>
        <span>${rarity} collectible card.</span>
      `;
      subtitle.offsetHeight;
      subtitle.classList.add('collectible-reward-text-fade-in');
      setTimeout(() => subtitle.classList.remove('collectible-reward-text-fade-in'), TEXT_FADE_IN_MS);
    }
  }, TEXT_FADE_OUT_MS + 50); // Wait for fade out to complete

  setTimeout(() => {
    sheet.dataset.revealing = '0';
    sheet.dataset.revealed = '1';
    if (cta) {
      cta.disabled = false;
      cta.classList.remove('revealing');
      cta.textContent = 'Collect';
    }
    if (cardContainer) {
      cardContainer.dataset.state = 'revealed';
      cardContainer.classList.remove('revealing');
      cardContainer.classList.add('revealed');
      cardContainer.setAttribute('aria-label', 'Collectible card revealed');
    }
    if (cardFront) {
      cardFront.style.transition = '';
      cardFront.style.transform = 'rotateY(0deg)';
      cardFront.style.opacity = '1';
    }
    if (cardBack) {
      cardBack.style.transition = '';
      cardBack.style.transform = 'rotateY(-180deg)';
      cardBack.style.opacity = '0';
    }
    if (puff) {
      puff.style.opacity = '0';
    }
  }, 700);
}
