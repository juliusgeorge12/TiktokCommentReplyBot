const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
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
    new MakerRpm({}),
    new MakerDeb({}),
    
  ],
  plugins: [],
  hooks: {
    postPackage: async (forgeConfig, options) => {
      let outputDir = options.outputPaths[0];
      //here check if the platform is mac or windows
      if (process.platform === 'darwin') {
        outputDir = path.join(outputDir, 'TiktokReplyBot.app', 'Contents', 'Resources')
      } else if (process.platform === 'win32') {
        outputDir = path.join(outputDir, 'resources');
      }
      const destination = path.join(outputDir, 'daemon', 'bin');
      const includeSource = path.resolve(__dirname, 'includes');
      const includeDestination =  path.join(outputDir, 'includes');
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
