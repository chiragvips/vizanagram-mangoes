import { defineConfig } from "orval";

export default defineConfig({
  "api-zod": {
    input: "./openapi.yaml",
    output: {
      target: "../api-zod/src/generated/schemas.ts",
      client: "zod",
      override: {
        zod: {
          generate: {
            body: true,
            header: true,
            param: true,
            query: true,
            response: true,
          },
        },
      },
    },
  },
  "api-client-react": {
    input: "./openapi.yaml",
    output: {
      target: "../api-client-react/src/generated/hooks.ts",
      client: "react-query",
      httpClient: "fetch",
    },
  },
});
