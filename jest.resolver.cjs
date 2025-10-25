const fs = require('fs');
const path = require('path');

module.exports = (request, options) => {
  const isRelativeJs = request.startsWith('.') && request.endsWith('.js');
  const basedir = options.basedir || '';
  const insideNodeModules = basedir.split(path.sep).includes('node_modules');

  if (isRelativeJs && !insideNodeModules) {
    const resolvedTsPath = path
      .resolve(basedir, request)
      .replace(/\.js$/, '.ts');

    if (fs.existsSync(resolvedTsPath)) {
      return resolvedTsPath;
    }
  }

  if (typeof options.defaultResolver === 'function') {
    return options.defaultResolver(request, options);
  }

  // Fallback when defaultResolver isn't provided (older Jest)
  const { defaultResolver } = require('jest-resolve');
  return defaultResolver(request, options);
};
