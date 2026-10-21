const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'expo-local-authentication', 'build', 'LocalAuthentication.types.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes("from 'expo-modules-core'") || content.includes("from 'expo'")) {
    content = content.replace("import { Platform } from 'expo-modules-core';", "import { Platform } from 'react-native';");
    content = content.replace("import { Platform } from 'expo';", "import { Platform } from 'react-native';");
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-expo-auth] Successfully patched LocalAuthentication.types.js with react-native Platform');
  } else {
    console.log('[patch-expo-auth] Already patched or using react-native Platform');
  }
} else {
  console.log('[patch-expo-auth] expo-local-authentication not found, skipping');
}
