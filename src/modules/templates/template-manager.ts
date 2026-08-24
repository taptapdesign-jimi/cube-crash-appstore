/**
 * 🎨 TEMPLATE MANAGER
 * 
 * Manages visual templates for cube-crash effects.
 * Allows easy switching between different visual styles (wooden, metal, glass, etc.)
 */

import woodenTemplate from './wooden-template.js';
import { GraphicsPool } from '../object-pool.js';
const isVerboseGameplayLogsEnabled = () => (typeof window !== 'undefined') && (window as any).__ccVerboseGameplayLogs === true;

// Type definitions
interface ShardPattern {
  angle: number;
  distance: number;
  size: number;
  speed: number;
  alpha: number;
}

interface TemplateColors {
  regular: number;
  wild: number;
  wildStar?: number;
  wildJuice?: number;
  wildMagnet?: number;
  smoke?: number;
  [key: string]: number | undefined;
}

interface DragParticleColors {
  regular: number[];
  wild?: number[];
  wildStar?: number[];
  wildJuice?: number[];
  wildMagnet?: number[];
  [key: string]: number[] | undefined;
}

interface BubbleColors {
  regular: number[];
  wild?: number[];
  wildStar?: number[];
  wildJuice?: number[];
  wildMagnet?: number[];
  [key: string]: number[] | undefined;
}

interface TemplatePatterns {
  [patternName: string]: ShardPattern[];
}

interface PatternMap {
  regular?: string[];
  wild?: string[];
  [mergeType: string]: string[] | undefined;
}

interface TemplateParams {
  regular?: Record<string, unknown>;
  wild?: Record<string, unknown>;
  [mergeType: string]: Record<string, unknown> | undefined;
}

export interface Template {
  name: string;
  displayName: string;
  colors: TemplateColors;
  dragParticleColors?: DragParticleColors;
  bubbleColors?: BubbleColors;
  patterns: TemplatePatterns;
  patternMap?: PatternMap;
  params?: TemplateParams;
}

interface PatternSelection {
  patternName: string;
  patternData: ShardPattern[];
  pool: GraphicsPool;
  template: Template;
}

// 🗂️ Registered Templates
const registeredTemplates = new Map<string, Template>();

// 🎯 Active Template
let activeTemplate: Template | null = null;

// 🔄 Pattern Pools - Each pattern has its own Graphics pool for reliable reuse
const patternPools = new Map<string, GraphicsPool>();

// 📊 Pattern Usage Counters (for round-robin selection)
const patternCounters = new Map<string, number>();

/**
 * Register a template
 * @param name - Template identifier (e.g., 'wooden', 'metal')
 * @param template - Template definition object
 */
export function registerTemplate(name: string, template: Template): boolean {
  if (!template || !template.patterns || !template.colors) {
    console.error(`❌ Invalid template: ${name}`, template);
    return false;
  }
  
  registeredTemplates.set(name, template);
  console.log(`✅ Template registered: ${name} (${template.displayName})`);
  
  // Initialize pattern pools for this template
  initializePatternPools(name, template);
  
  return true;
}

/**
 * Initialize Graphics pools for each pattern in a template
 * @param templateName - Template name
 * @param template - Template object
 */
function initializePatternPools(templateName: string, template: Template): void {
  Object.keys(template.patterns).forEach(patternName => {
    const pattern = template.patterns[patternName];
    const poolKey = `${templateName}:${patternName}`;
    
    // Create pool for this pattern
    // GraphicsPool uses default maxSize (150) internally
    patternPools.set(poolKey, new GraphicsPool());
    
    // Initialize pattern counter
    patternCounters.set(poolKey, 0);
    
    console.log(`  📦 Pattern pool created: ${poolKey} (${pattern.length} shards)`);
  });
}

/**
 * Set the active template
 * @param name - Template name to activate
 */
export function setActiveTemplate(name: string): boolean {
  const template = registeredTemplates.get(name);
  
  if (!template) {
    console.error(`❌ Template not found: ${name}`);
    return false;
  }
  
  activeTemplate = template;
  console.log(`🎨 Active template set: ${name} (${template.displayName})`);
  
  return true;
}

/**
 * Get the active template
 * @returns Active template or null
 */
export function getActiveTemplate(): Template | null {
  return activeTemplate;
}

/**
 * Get a specific template by name
 * @param name - Template name
 * @returns Template or null
 */
export function getTemplate(name: string): Template | null {
  return registeredTemplates.get(name) || null;
}

/**
 * Select a pattern for a given merge type
 * Uses round-robin selection to distribute patterns evenly
 * 
 * @param mergeType - 'regular' or 'wild'
 * @returns Pattern selection object or null
 */
export function selectPattern(mergeType: string): PatternSelection | null {
  if (!activeTemplate) {
    console.error('❌ selectPattern: No active template set - template manager may not be initialized');
    console.error('❌ Available templates:', Array.from(registeredTemplates.keys()));
    return null;
  }
  
  // Get available patterns for this merge type
  const availablePatterns = activeTemplate.patternMap?.[mergeType];
  
  if (!availablePatterns || availablePatterns.length === 0) {
    console.error(`❌ selectPattern: No patterns available for merge type: ${mergeType}`, {
      activeTemplate: activeTemplate.name,
      patternMap: activeTemplate.patternMap,
      mergeType
    });
    return null;
  }
  
  // Round-robin selection (cycles through patterns)
  const counterKey = `${activeTemplate.name}:${mergeType}`;
  const counter = patternCounters.get(counterKey) || 0;
  const patternIndex = counter % availablePatterns.length;
  const patternName = availablePatterns[patternIndex];
  
  // Update counter for next time
  patternCounters.set(counterKey, counter + 1);
  
  // Get pattern data
  const patternData = activeTemplate.patterns?.[patternName];
  
  if (!patternData) {
    console.error(`❌ selectPattern: Pattern data not found for pattern: ${patternName}`, {
      activeTemplate: activeTemplate.name,
      availablePatterns: Object.keys(activeTemplate.patterns || {})
    });
    return null;
  }
  
  // Get pool for this pattern
  const poolKey = `${activeTemplate.name}:${patternName}`;
  const pool = patternPools.get(poolKey);
  
  if (!pool) {
    console.error(`❌ selectPattern: Pool not found for pattern: ${poolKey}`, {
      availablePools: Array.from(patternPools.keys()),
      activeTemplate: activeTemplate.name,
      patternName
    });
    return null;
  }
  
  if (isVerboseGameplayLogsEnabled()) {
    console.log(`✅ selectPattern: Selected pattern "${patternName}" for merge type "${mergeType}"`, {
      poolKey,
      shardCount: patternData.length,
      poolStats: (pool as any).getStats?.()
    });
  }
  
  return {
    patternName,
    patternData,
    pool,
    template: activeTemplate
  };
}

/**
 * Get color for a merge type
 * @param colorType - 'regular', 'wild', 'wildMagnet', 'smoke'
 * @returns Color hex value
 */
export function getColor(colorType: string): number {
  if (!activeTemplate) {
    console.error('❌ No active template set');
    return 0xFFFFFF; // Default white
  }
  
  return activeTemplate.colors[colorType] || 0xFFFFFF;
}

/**
 * Get drag particle colors for a tile type
 * @param tileSpecial - 'wild', 'wild-juice', 'wild-magnet', or null for regular
 * @returns Array of color hex values
 */
export function getDragParticleColors(tileSpecial: string | null): number[] {
  if (!activeTemplate) {
    console.error('❌ getDragParticleColors: No active template set');
    return [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0]; // Default beige/cream
  }
  
  // Map tile special to template color key
  let colorKey = 'regular'; // Default
  if (tileSpecial === 'wild') {
    colorKey = 'wild';
  } else if (tileSpecial === 'wild-juice') {
    colorKey = 'wildJuice';
  } else if (tileSpecial === 'wild-tnt') {
    colorKey = 'wildTnt';
  } else if (tileSpecial === 'wild-magnet') {
    colorKey = 'wildMagnet';
  }
  
  // Get colors from template's dragParticleColors
  const colors = activeTemplate.dragParticleColors?.[colorKey];
  
  if (!colors || !Array.isArray(colors) || colors.length === 0) {
    console.warn(`⚠️ getDragParticleColors: No drag particle colors found for ${colorKey} (tileSpecial: ${tileSpecial}), using default`);
    return [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0]; // Default beige/cream
  }
  
  // 🔥 DEBUG: Log color retrieval (only first time per tile type to avoid spam)
  const globalObj = globalThis as typeof globalThis & {
    __dragParticleColorLogs?: Set<string>;
  };
  
  if (!globalObj.__dragParticleColorLogs) {
    globalObj.__dragParticleColorLogs = new Set();
  }
  if (isVerboseGameplayLogsEnabled() && !globalObj.__dragParticleColorLogs.has(colorKey)) {
    console.log(`✅ getDragParticleColors: Loaded ${colors.length} colors for ${colorKey} (${tileSpecial}):`, colors.map(c => `0x${c.toString(16).toUpperCase()}`).join(', '));
    globalObj.__dragParticleColorLogs.add(colorKey);
  }
  
  return colors;
}

/**
 * Get bubble colors for a tile type (for full-screen bubbles explosion)
 * @param tileSpecial - 'wild', 'wild-juice', 'wild-magnet', or null for regular
 * @returns Array of color hex values
 */
export function getBubbleColors(tileSpecial: string | null): number[] {
  if (!activeTemplate) {
    console.error('❌ getBubbleColors: No active template set');
    return [0xFFFFFF, 0xFEF9F5, 0xFDF5ED, 0xFCF0E5]; // Default white/cream bubbles
  }
  
  // Map tile special to template color key
  let colorKey = 'regular'; // Default
  if (tileSpecial === 'wild') {
    colorKey = 'wild';
  } else if (tileSpecial === 'wild-juice') {
    colorKey = 'wildJuice';
  } else if (tileSpecial === 'wild-tnt') {
    colorKey = 'wildTnt';
  } else if (tileSpecial === 'wild-magnet') {
    colorKey = 'wildMagnet';
  }
  
  // Get colors from template's bubbleColors
  const colors = activeTemplate.bubbleColors?.[colorKey];
  
  if (!colors || !Array.isArray(colors) || colors.length === 0) {
    console.warn(`⚠️ getBubbleColors: No bubble colors found for ${colorKey} (tileSpecial: ${tileSpecial}), using default white`);
    return [0xFFFFFF, 0xFEF9F5, 0xFDF5ED, 0xFCF0E5]; // Default white/cream bubbles
  }
  
  return colors;
}

/**
 * Get parameters for a merge type
 * @param mergeType - 'regular' or 'wild'
 * @returns Parameters object
 */
export function getParams(mergeType: string): Record<string, unknown> {
  if (!activeTemplate) {
    console.error('❌ No active template set');
    return {};
  }
  
  return activeTemplate.params?.[mergeType] || {};
}

/**
 * List all registered templates
 * @returns Array of template names
 */
export function listTemplates(): string[] {
  return Array.from(registeredTemplates.keys());
}

/**
 * Reset pattern counters (for testing/debugging)
 */
export function resetPatternCounters(): void {
  patternCounters.forEach((_value, key) => {
    patternCounters.set(key, 0);
  });
  console.log('🔄 Pattern counters reset');
}

/**
 * 🔥 FIX: Cleanup pattern pools to prevent memory leaks
 * Call this when switching templates or during app cleanup
 * @param templateName - Optional: cleanup only pools for this template
 */
export function cleanupTemplatePools(templateName?: string): void {
  if (templateName) {
    // Clean up pools for a specific template
    const keysToDelete: string[] = [];
    patternPools.forEach((pool, key) => {
      if (key.startsWith(`${templateName}:`)) {
        try {
          if (pool && typeof pool.clear === 'function') {
            pool.clear();
          }
        } catch (e) {
          console.warn(`⚠️ Failed to clear pool ${key}:`, e);
        }
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      patternPools.delete(key);
      patternCounters.delete(key);
    });
    console.log(`✅ Template pools cleaned up for: ${templateName} (${keysToDelete.length} pools)`);
  } else {
    // Clean up all pools
    patternPools.forEach((pool, key) => {
      try {
        if (pool && typeof pool.clear === 'function') {
          pool.clear();
        }
      } catch (e) {
        console.warn(`⚠️ Failed to clear pool ${key}:`, e);
      }
    });
    patternPools.clear();
    patternCounters.clear();
    console.log('✅ All template pools cleaned up');
  }
}

// 🚀 Initialize with wooden template as default
registerTemplate('wooden', woodenTemplate as Template);
setActiveTemplate('wooden');

console.log('🎨 Template Manager initialized with wooden template');
