// Simple Router for Lazy Screen Loading
import type { HTMLElementConfig } from './components/html-builder.js';

export interface Route {
  path: string;
  component: () => HTMLElementConfig;
  load?: () => Promise<void>;
}

class Router {
  private routes: Map<string, Route> = new Map();
  private currentRoute: string = '';
  private container: HTMLElement | null = null;
  private loadedRoutes: Set<string> = new Set();

  constructor(containerId: string) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Router container ${containerId} not found`);
    }
  }

  register(route: Route): void {
    this.routes.set(route.path, route);
  }

  async navigate(path: string): Promise<void> {
    if (this.currentRoute === path) return;

    const route = this.routes.get(path);
    if (!route) {
      console.error(`Route ${path} not found`);
      return;
    }

    // Load route if not already loaded
    if (!this.loadedRoutes.has(path) && route.load) {
      await route.load();
      this.loadedRoutes.add(path);
    }

    // Render route
    if (this.container) {
      this.container.innerHTML = '';
      // The component returns config, we'll render it
      // For now, this is a placeholder for lazy loading logic
    }

    this.currentRoute = path;
  }

  getCurrentRoute(): string {
    return this.currentRoute;
  }

  isRouteLoaded(path: string): boolean {
    return this.loadedRoutes.has(path);
  }
}

export const router = new Router('app-router');
