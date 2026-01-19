// CSS and DOM extensions for ultra-permissive access

declare global {
  interface CSSStyleDeclaration {
    // Allow any property access (for vendor prefixes)
    [key: string]: any;
    webkitTouchCallout?: string;
  }
}

export {};

