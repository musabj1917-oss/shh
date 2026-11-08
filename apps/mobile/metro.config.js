const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const defaults = getDefaultConfig(projectRoot);
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    ...defaults.resolver,
    resolveRequest: (context, moduleName, platform) => {
      try {
        return context.resolveRequest(context, moduleName, platform);
      } catch (err) {
        if (typeof moduleName === 'string' && moduleName.endsWith('.js')) {
          const stripped = moduleName.slice(0, -3);
          try {
            return context.resolveRequest(context, stripped, platform);
          } catch {}
        }
        throw err;
      }
    },
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(defaults, config);
