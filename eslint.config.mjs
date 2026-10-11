import tsParser from "@typescript-eslint/parser";

/**
 * CRM UI guardrails.
 *
 * Every page/component must compose the shared system in `components/ui`
 * (see AGENTS.md). These rules fail the build when work drifts back to
 * ad-hoc palettes, hard-black buttons, one-off radii, or hand-rolled tables.
 *
 * The shared primitive file itself (`components/ui/index.tsx`) is exempt so it
 * can implement the tokens.
 */

const CLASS_RULES = [
  {
    selector: "Literal[value=/gray-\\d/]",
    message:
      "Use the shared palette tokens (ink-*/accent-*/surface/border/muted) — raw gray-* is banned (AGENTS.md).",
  },
  {
    selector: "Literal[value=/bg-ink-950 /]",
    message:
      "Primary buttons must use the accent (bg-accent-600 via Button) — bg-ink-950 pills are banned (AGENTS.md).",
  },
  {
    selector: "Literal[value=/rounded-(md|lg|sm)\\b/]",
    message:
      "Use rounded-card / rounded-field / rounded-full from the shared system — rounded-md/lg/sm are banned (AGENTS.md).",
  },
  {
    selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
    message:
      "No hex color literals — use the semantic tokens (AGENTS.md).",
  },
];

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "*.config.js",
      "prisma/**",
    ],
  },
  {
    files: ["pages/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["components/ui/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-syntax": ["error", ...CLASS_RULES],
    },
  },
  {
    // Pages must use the shared <Table>, not raw markup.
    files: ["pages/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        ...CLASS_RULES,
        {
          selector: 'JSXOpeningElement[name.name="table"]',
          message:
            "Use the shared <Table>/<Th>/<Td> from components/ui instead of a raw <table> (AGENTS.md).",
        },
      ],
    },
  },
];
