// Dependency Injection Container for loose coupling
export type ServiceConstructor<T = any> = new (...args: any[]) => T;
export type ServiceFactory<T = any> = (...args: any[]) => T;
export type ServiceInstance<T = any> = T;

export interface ServiceDefinition<T = any> {
  constructor?: ServiceConstructor<T>;
  factory?: ServiceFactory<T>;
  instance?: ServiceInstance<T>;
  singleton?: boolean;
  dependencies?: string[];
}

class DIContainer {
  private services: Map<string, ServiceDefinition> = new Map();
  private instances: Map<string, any> = new Map();

  register<T>(name: string, definition: ServiceDefinition<T>): void {
    this.services.set(name, definition);
  }

  get<T>(name: string): T {
    // Return existing instance if singleton
    if (this.instances.has(name)) {
      return this.instances.get(name) as T;
    }

    const definition = this.services.get(name);
    if (!definition) {
      throw new Error(`Service '${name}' not registered`);
    }

    let instance: T;

    if (definition.instance) {
      instance = definition.instance as T;
    } else if (definition.factory) {
      const dependencies = this.resolveDependencies(definition.dependencies || []);
      instance = definition.factory(...dependencies) as T;
    } else if (definition.constructor) {
      const dependencies = this.resolveDependencies(definition.dependencies || []);
      instance = new definition.constructor(...dependencies) as T;
    } else {
      throw new Error(`Invalid service definition for '${name}'`);
    }

    // Store instance if singleton
    if (definition.singleton !== false) {
      this.instances.set(name, instance);
    }

    return instance;
  }

  private resolveDependencies(dependencies: string[]): any[] {
    return dependencies.map(dep => this.get(dep));
  }

  setMultiple(services: Record<string, any>): void {
    Object.entries(services).forEach(([name, instance]) => {
      this.register(name, {
        instance,
        singleton: true,
      });
    });
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  clear(): void {
    this.services.clear();
    this.instances.clear();
  }
}

// Singleton instance
export const container = new DIContainer();

// Service names for type safety
export const SERVICES = {
  GAME_STATE: 'gameState',
  UI_MANAGER: 'uiManager',
  ANIMATION_MANAGER: 'animationManager',
  SLIDER_MANAGER: 'sliderManager',
  IOS_OPTIMIZER: 'iosOptimizer',
  MEMORY_MANAGER: 'memoryManager',
  ERROR_HANDLER: 'errorHandler',
  EVENT_BUS: 'eventBus',
  LOGGER: 'logger',
} as const;

export type ServiceName = typeof SERVICES[keyof typeof SERVICES];