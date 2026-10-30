const path = require('path');

module.exports = {
  project: {
    android: {
      sourceDir: path.resolve(__dirname, 'android'),
      manifestPath: path.resolve(__dirname, 'android/app/src/main/AndroidManifest.xml'),
      packageName: 'com.haikumessenger',
    },
  },
};
