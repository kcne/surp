const path = require("path")
const { defineConfig } = require("orval")

module.exports = defineConfig({
  surpApi: {
    input: {
      target: path.resolve(__dirname, "../api/docs/openapi.json"),
    },
    output: {
      target: path.resolve(__dirname, "./infrastructure/generated/surp-api.ts"),
      schemas: path.resolve(__dirname, "./infrastructure/generated/model"),
      client: "react-query",
      mode: "single",
      clean: true,
      override: {
        mutator: {
          path: path.resolve(__dirname, "./infrastructure/orval/orval-mutator.ts"),
          name: "customInstance",
        },
      },
    },
  },
})
