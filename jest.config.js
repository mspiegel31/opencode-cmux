/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          // Override moduleResolution to node16 for ts-jest compatibility
          // (bundler resolution isn't supported by ts-jest's transformer)
          moduleResolution: "node16",
          module: "node16",
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
}

export default config
