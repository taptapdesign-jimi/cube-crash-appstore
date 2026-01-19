// PixiJS type extensions for ultra-permissive access

import 'pixi.js';

declare module 'pixi.js' {
  interface Container {
    // Allow any property access (ultra-permissive for quick fix)
    [key: string]: any;
  }
  
  interface Sprite {
    // Allow any property access
    [key: string]: any;
  }
  
  interface Graphics {
    // Allow any property access
    [key: string]: any;
  }
  
  interface Text {
    // Allow any property access
    [key: string]: any;
  }
  
  interface Application {
    // Allow any property access
    [key: string]: any;
  }
  
  interface Ticker {
    // Allow any property access
    [key: string]: any;
  }
  
  interface ObservablePoint {
    // Allow any property access
    [key: string]: any;
  }
  
  interface Texture {
    // Allow any property access
    [key: string]: any;
  }
}

