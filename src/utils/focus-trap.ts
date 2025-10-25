// Focus Trap Utility for Accessibility
// Ensures keyboard navigation stays within modal/screen bounds

export interface FocusTrapOptions {
  container: HTMLElement;
  onEscape?: () => void;
  initialFocus?: HTMLElement | string;
}

export class FocusTrap {
  private container: HTMLElement;
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;
  private onEscape?: () => void;
  private previousFocus: HTMLElement | null = null;

  constructor(options: FocusTrapOptions) {
    this.container = options.container;
    this.onEscape = options.onEscape;

    // Store previous focus
    this.previousFocus = document.activeElement as HTMLElement;

    // Find all focusable elements
    this.updateFocusableElements();

    // Set initial focus
    if (options.initialFocus) {
      if (typeof options.initialFocus === 'string') {
        const element = this.container.querySelector(options.initialFocus) as HTMLElement;
        if (element) {
          this.setInitialFocus(element);
        }
      } else {
        this.setInitialFocus(options.initialFocus);
      }
    } else {
      this.setInitialFocus(this.firstFocusable);
    }

    // Bind event listeners
    this.bindEvents();
  }

  private updateFocusableElements(): void {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusableElements = Array.from(
      this.container.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => {
      // Filter out hidden elements
      return !el.hasAttribute('hidden') && 
             !el.classList.contains('hidden') && 
             el.style.display !== 'none';
    });

    this.firstFocusable = focusableElements[0] || null;
    this.lastFocusable = focusableElements[focusableElements.length - 1] || null;
  }

  private setInitialFocus(element: HTMLElement | null): void {
    if (element) {
      element.focus();
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Handle Escape key
    if (e.key === 'Escape' && this.onEscape) {
      this.onEscape();
      return;
    }

    // Handle Tab key
    if (e.key === 'Tab') {
      // If only one focusable element, prevent tab
      if (this.firstFocusable === this.lastFocusable) {
        e.preventDefault();
        return;
      }

      // Shift + Tab
      if (e.shiftKey) {
        if (document.activeElement === this.firstFocusable) {
          e.preventDefault();
          this.lastFocusable?.focus();
        }
      } 
      // Tab
      else {
        if (document.activeElement === this.lastFocusable) {
          e.preventDefault();
          this.firstFocusable?.focus();
        }
      }
    }
  };

  private bindEvents(): void {
    this.container.addEventListener('keydown', this.handleKeyDown);
  }

  private unbindEvents(): void {
    this.container.removeEventListener('keydown', this.handleKeyDown);
  }

  public update(): void {
    this.updateFocusableElements();
  }

  public destroy(): void {
    this.unbindEvents();

    // Restore previous focus
    if (this.previousFocus) {
      this.previousFocus.focus();
    }

    // Clear references
    this.firstFocusable = null;
    this.lastFocusable = null;
    this.previousFocus = null;
  }
}

// Export convenience function
export function createFocusTrap(options: FocusTrapOptions): FocusTrap {
  return new FocusTrap(options);
}
