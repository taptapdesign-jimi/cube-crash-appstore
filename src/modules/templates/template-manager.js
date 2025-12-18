/**
 * 🎨 TEMPLATE MANAGER
 * 
 * Manages visual templates for cube-crash effects.
 * Allows easy switching between different visual styles (wooden, metal, glass, etc.)
 */

import woodenTemplate from './wooden-template.js';
import { GraphicsPool } from '../object-pool.ts';

// 🗂️ Registered Templates
const registeredTemplates = new Map();

// 🎯 Active Template
let activeTemplate = null;

// 🔄 Pattern Pools - Each pattern has its own Graphics pool for reliable reuse
const patternPools = new Map();

// 📊 Pattern Usage Counters (for round-robin selection)
const patternCounters = new Map();

/**
 * Register a template
 * @param {string} name - Template identifier (e.g., 'wooden', 'metal')
 * @param {object} template - Template definition object
 */
export function registerTemplate(name, template) {
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
 * @param {string} templateName - Template name
 * @param {object} template - Template object
 */
function initializePatternPools(templateName, template) {
  Object.keys(template.patterns).forEach(patternName => {
    const pattern = template.patterns[patternName];
    const poolKey = `${templateName}:${patternName}`;
    
    // Create pool for this pattern (size = pattern shard count * 2 for safety)
    const poolSize = pattern.length * 3; // 3x pattern size for multiple simultaneous merges
    patternPools.set(poolKey, new GraphicsPool(poolSize));
    
    // Initialize pattern counter
    patternCounters.set(poolKey, 0);
    
    console.log(`  📦 Pattern pool created: ${poolKey} (${pattern.length} shards, pool size: ${poolSize})`);
  });
}

/**
 * Set the active template
 * @param {string} name - Template name to activate
 */
export function setActiveTemplate(name) {
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
 * @returns {object|null} Active template or null
 */
export function getActiveTemplate() {
  return activeTemplate;
}

/**
 * Get a specific template by name
 * @param {string} name - Template name
 * @returns {object|null} Template or null
 */
export function getTemplate(name) {
  return registeredTemplates.get(name) || null;
}

/**
 * Select a pattern for a given merge type
 * Uses round-robin selection to distribute patterns evenly
 * 
 * @param {string} mergeType - 'regular' or 'wild'
 * @returns {object|null} { patternName, patternData, pool }
 */
export function selectPattern(mergeType) {
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
  
  console.log(`✅ selectPattern: Selected pattern "${patternName}" for merge type "${mergeType}"`, {
    poolKey,
    shardCount: patternData.length,
    poolStats: pool.getStats?.()
  });
  
  return {
    patternName,
    patternData,
    pool,
    template: activeTemplate
  };
}

/**
 * Get color for a merge type
 * @param {string} colorType - 'regular', 'wild', 'wildMagnet', 'smoke'
 * @returns {number} Color hex value
 */
export function getColor(colorType) {
  if (!activeTemplate) {
    console.error('❌ No active template set');
    return 0xFFFFFF; // Default white
  }
  
  return activeTemplate.colors[colorType] || 0xFFFFFF;
}

/**
 * Get parameters for a merge type
 * @param {string} mergeType - 'regular' or 'wild'
 * @returns {object} Parameters object
 */
export function getParams(mergeType) {
  if (!activeTemplate) {
    console.error('❌ No active template set');
    return {};
  }
  
  return activeTemplate.params[mergeType] || {};
}

/**
 * List all registered templates
 * @returns {Array} Array of template names
 */
export function listTemplates() {
  return Array.from(registeredTemplates.keys());
}

/**
 * Reset pattern counters (for testing/debugging)
 */
export function resetPatternCounters() {
  patternCounters.forEach((value, key) => {
    patternCounters.set(key, 0);
  });
  console.log('🔄 Pattern counters reset');
}

// 🚀 Initialize with wooden template as default
registerTemplate('wooden', woodenTemplate);
setActiveTemplate('wooden');

console.log('🎨 Template Manager initialized with wooden template');

