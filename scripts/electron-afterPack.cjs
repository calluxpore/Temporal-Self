/**
 * electron-builder afterPack hook: set Windows exe "File description" and
 * "Product name" so Task Manager shows "Temporal Self" instead of "Electron".
 */
const path = require('path');

const PRODUCT_NAME = 'Temporal Self';
const FILE_DESCRIPTION = 'Map and organize your memories in time and place';

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const exeName = `${PRODUCT_NAME}.exe`;
  const exePath = path.join(context.appOutDir, exeName);

  try {
    const { rcedit } = await import('rcedit');
    await rcedit(exePath, {
      'version-string': {
        ProductName: PRODUCT_NAME,
        FileDescription: FILE_DESCRIPTION,
      },
    });
  } catch (err) {
    console.warn('electron-afterPack: could not set exe metadata:', err.message);
  }
};
