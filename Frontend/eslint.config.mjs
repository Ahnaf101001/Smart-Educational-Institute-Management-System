import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**"]),
  {
    rules: {
      // Screens load data in effects (setLoading/setData), which works correctly; the React
      // Compiler flags it as a refactoring opportunity, so it is reported as a warning.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
