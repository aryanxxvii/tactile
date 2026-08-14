import eslint from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import promise from "eslint-plugin-promise";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "tmp/**", "benchmarks/.generated/**", "tests/visual/baselines/**"],
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.js", "src/**/*.jsx", "worker/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-extra-boolean-cast": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    files: [
      "*.js",
      "*.mjs",
      "benchmarks/**/*.mjs",
      "docs/**/*.mjs",
      "scripts/**/*.mjs",
      "tests/**/*.mjs",
      "src/compat/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      import: importPlugin,
      "jsx-a11y": jsxA11y,
      promise,
      "react-hooks": reactHooks,
    },
    settings: {
      "import/resolver": {
        node: true,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "import/no-unresolved": "off",
      "import/first": "warn",
      "import/order": ["warn", { "newlines-between": "always" }],
      "jsx-a11y/alt-text": "warn",
      "promise/always-return": "warn",
      "promise/catch-or-return": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
