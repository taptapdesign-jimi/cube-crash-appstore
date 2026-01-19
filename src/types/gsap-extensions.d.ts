// GSAP type extensions for ultra-permissive tweening

declare module 'gsap' {
  // Make gsap.to/from/fromTo accept any type (ultra-permissive)
  interface gsap {
    to(target: any, vars: any): any;
    from(target: any, vars: any): any;
    fromTo(target: any, fromVars: any, toVars: any): any;
    set(target: any, vars: any): any;
    timeline(vars?: any): any;
    delayedCall(delay: number, callback: Function, params?: any[], scope?: any): any;
    killTweensOf(target: any): void;
  }
  
  // Make TweenTarget ultra-permissive
  type TweenTarget = any;
}

export {};

