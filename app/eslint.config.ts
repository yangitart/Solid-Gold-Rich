// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from 'eslint/config'
const expoConfig = require('eslint-config-expo/flat')

export default defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],

    rules: {
      '@typescript-eslint/no-unused-vars': ['error'],
    },
  },
])
