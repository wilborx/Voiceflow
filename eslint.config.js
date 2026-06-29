import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import tsdoc from "eslint-plugin-tsdoc";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));
const project = fileURLToPath(new URL("./tsconfig.base.json", import.meta.url));

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "**/dist/**",
      "**/.tsbuildinfo",
      ".local/**",
      ".git/**",
      "coverage/**",
      "libs/**/generated/**",
      "lib/**/generated/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project,
        tsconfigRootDir,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      tsdoc: tsdoc,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "warn",
      "no-console": "error",
      "tsdoc/syntax": "off",
    },
  },
  {
    files: ["libs/db/scripts/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
