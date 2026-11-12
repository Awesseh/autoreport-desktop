const updateUrl = process.env.EASY_REPORT_UPDATE_URL

module.exports = {
  appId: 'com.easyreport.desktop',
  productName: 'Easy Report',
  directories: { output: 'release' },
  files: ['out/**/*', 'package.json'],
  extraResources: [{ from: 'resources/tessdata', to: 'tessdata' }],
  win: { target: 'nsis' },
  mac: { target: 'dmg' },
  linux: { target: 'AppImage' },
  publish: updateUrl ? [{ provider: 'generic', url: updateUrl }] : []
}
