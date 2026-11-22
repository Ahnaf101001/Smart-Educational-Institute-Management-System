import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**"]),
  {
    rules: {
      // Screens load data when they open (useEffect(() => { load(); }, [load]) with setLoading/setData),
      // which works correctly. The React Compiler rule only flags it as a refactoring opportunity.
      "react-hooks/set-state-in-effect": "off",
      // <img> is intentional: images are uploaded files served through the backend proxy, QR-code data
      // URIs and ID cards sized in millimetres for printing. next/image needs fixed pixel sizes and a
      // loader for those sources and would break card printing.
      "@next/next/no-img-element": "off",
    },
  },
]);
