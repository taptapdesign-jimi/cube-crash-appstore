// Accessibility utilities for App Store compliance
export class AccessibilityManager {
  private static instance: AccessibilityManager;
  private isEnabled: boolean = true;
  private isInitialized: boolean = false;
  private motionQuery: MediaQueryList | null = null;
  private readonly handleMotionPreferenceChange = (e: MediaQueryListEvent): void => {
    this.isEnabled = !e.matches;
    if (!this.isEnabled) {
      this.disableAnimations();
    }
  };
  private readonly handleKeyboardNavigation = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        // Handle game navigation
        break;
      case ' ':
        event.preventDefault();
        // Handle pause/play
        break;
      case 'Escape':
        event.preventDefault();
        // Handle escape actions
        break;
    }
  };

  static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }

  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Check for reduced motion preference
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (this.motionQuery.matches) {
      this.isEnabled = false;
      this.disableAnimations();
    }

    // Listen for changes in motion preference
    this.motionQuery.addEventListener('change', this.handleMotionPreferenceChange);

    // Add keyboard navigation support
    this.addKeyboardNavigation();
  }

  private disableAnimations(): void {
    // Add CSS class to disable animations
    document.body.classList.add('reduce-motion');
  }

  private addKeyboardNavigation(): void {
    // Add keyboard event listeners for game controls
    document.addEventListener('keydown', this.handleKeyboardNavigation);
  }

  announceToScreenReader(message: string): void {
    if (this.isEnabled) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  }

  setFocus(element: HTMLElement): void {
    if (this.isEnabled && element) {
      element.focus();
    }
  }

  destroy(): void {
    if (!this.isInitialized) return;
    this.isInitialized = false;

    try {
      this.motionQuery?.removeEventListener('change', this.handleMotionPreferenceChange);
    } catch {}
    this.motionQuery = null;

    try {
      document.removeEventListener('keydown', this.handleKeyboardNavigation);
    } catch {}
  }
}
