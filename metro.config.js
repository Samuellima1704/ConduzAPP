const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
const existing = config.resolver.blockList || [];
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : [existing]),
  /[/\\]\.tools[/\\].*/,
  /[/\\]functions[/\\]node_modules[/\\].*/,
  // Dados dos emuladores e pastas temporárias do salvamento automático: são
  // criadas e apagadas a cada 2 min e derrubavam o vigia de arquivos do Metro (ENOENT).
  /[/\\]\.emulator-data[^/\\]*[/\\].*/,
  /[/\\]firebase-export-[^/\\]*[/\\].*/,
];
config.maxWorkers = 2;
module.exports = config;
