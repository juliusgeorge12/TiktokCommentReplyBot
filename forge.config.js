const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerZIP } = require('@electron-forge/maker-zip');
const { MakerDeb } = require('@electron-forge/maker-deb');
const { MakerRpm } = require('@electron-forge/maker-rpm');
const { MakerDMG } = require('@electron-forge/maker-dmg');

const path = require('path');
const fse = require('fs-extra');

module.exports = {
  packagerConfig: {
    asar: true,
  },
  extraResource: [
    'patch-sqlite3.js',
  ],
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'TiktokReplyBotApp',
      authors: 'Julius George',
      description: 'A Tool that reply to comments on tiktok posts',
      exe: 'TiktokReplyBot.exe',
      setupExe: 'TiktokReplyBotInstaller.exe',
      noMsi: true,
    }),
    new MakerDMG({
      name: 'TiktokReplyBotApp',
      overwrite: true,
      format: 'ULFO'
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
    
  ],
  plugins: [],
  hooks: {
    postPackage: async (forgeConfig, options) => {
      const outputDir = options.outputPaths[0];

      const destination = path.join(outputDir, 'resources', 'daemon', 'bin');
      const includeSource = path.resolve(__dirname, 'includes');
      const includeDestination = path.join(outputDir, 'resources', 'includes');
      const source = path.resolve(__dirname, 'apps/bin');

      console.log(`[postPackage] Copying daemon binaries from ${source} to ${destination}`);

      try {
        await fse.ensureDir(destination);
        await fse.copy(source, destination, { overwrite: true });
        console.log('[postPackage] Binaries copied successfully.');
        await fse.copy(includeSource, includeDestination, { overwrite: true });
        console.log('[postPackage] includes copied successfully.');
      } catch (err) {
        console.error('[postPackage] Failed to copy daemon binaries:', err);
        throw err;
      }
    },
  },
};
