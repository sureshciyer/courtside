import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Flat-config ESLint for this project.
//
// Primary goal: catch JSX that references an unbound identifier
// (e.g. <Badge> without importing Badge). That's `react/jsx-no-undef`,
// plus `react/jsx-uses-vars` which marks JSX-referenced imports as used
// (otherwise `no-unused-vars` flags every UI component import).

export default [
  { ignores: ["dist/**", "node_modules/**", "legacy/**", ".vercel/**", "coverage/**"] },

  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"], // new JSX transform — no React import required

  // React version applies to both the preset and our custom block below.
  { settings: { react: { version: "detect" } } },

  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // ---- the bug-catcher we asked for ----
      "react/jsx-no-undef": "error",
      "react/jsx-uses-vars": "error",

      // ---- react hooks correctness ----
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ---- off: not useful for this app ----
      "react/prop-types": "off",            // no PropTypes in use
      "react/no-unescaped-entities": "off", // overly strict for copy
      "react/display-name": "off",          // anonymous components are fine

      // ---- unused vars: warn, allow _-prefixed intentionally-unused ----
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // ---- core correctness ----
      "no-undef": "error",
    },
  },

  // Config files run in Node.
  {
    files: ["*.config.js", "eslint.config.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
