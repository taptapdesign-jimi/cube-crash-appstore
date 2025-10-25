// HTML Builder - Simple component composition utility
// For building modular HTML from TypeScript

export interface HTMLElementConfig {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  html?: string;
  attributes?: Record<string, string>;
  children?: HTMLElementConfig[];
  eventListeners?: Record<string, (e: Event) => void>;
}

export class HTMLBuilder {
  private static container: DocumentFragment | null = null;

  static createElement(config: HTMLElementConfig): HTMLElement {
    const element = document.createElement(config.tag);

    // Set ID
    if (config.id) {
      element.id = config.id;
    }

    // Set class name
    if (config.className) {
      element.className = config.className;
    }

    // Set text content
    if (config.text) {
      element.textContent = config.text;
    }

    // Set HTML content
    if (config.html) {
      element.innerHTML = config.html;
    }

    // Set attributes
    if (config.attributes) {
      Object.entries(config.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    // Add children
    if (config.children) {
      config.children.forEach(childConfig => {
        const childElement = this.createElement(childConfig);
        element.appendChild(childElement);
      });
    }

    // Add event listeners
    if (config.eventListeners) {
      Object.entries(config.eventListeners).forEach(([event, handler]) => {
        element.addEventListener(event, handler);
      });
    }

    return element;
  }

  static createFragment(elements: HTMLElementConfig[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    elements.forEach(config => {
      fragment.appendChild(this.createElement(config));
    });
    return fragment;
  }

  static renderToContainer(
    containerId: string,
    elements: HTMLElementConfig | HTMLElementConfig[]
  ): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    container.innerHTML = '';

    if (Array.isArray(elements)) {
      elements.forEach(config => {
        container.appendChild(this.createElement(config));
      });
    } else {
      container.appendChild(this.createElement(elements));
    }
  }

  static fromString(htmlString: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content;
  }
}

// Convenience functions
export const createButton = (
  id: string,
  text: string,
  className: string,
  onClick?: (e: Event) => void
): HTMLElementConfig => ({
  tag: 'button',
  id,
  className,
  text,
  attributes: { type: 'button' },
  eventListeners: onClick ? { click: onClick } : undefined,
});

export const createDiv = (
  id: string,
  className?: string,
  children?: HTMLElementConfig[]
): HTMLElementConfig => ({
  tag: 'div',
  id,
  className,
  children,
});

export const createImage = (
  id: string,
  src: string,
  alt: string,
  className?: string
): HTMLElementConfig => ({
  tag: 'img',
  id,
  className,
  attributes: { src, alt },
});

export const createHeading = (
  tag: 'h1' | 'h2' | 'h3',
  text: string,
  className?: string
): HTMLElementConfig => ({
  tag,
  text,
  className,
});
