module.exports = {
  plugins: ["@snowpack/plugin-typescript"],
  installOptions: {},
  devOptions: {
    port: 8080,
    fallback: "index.html",
    open: "default",
    output: "dashboard",
    hostname: "localhost",
    hmr: true,
    hmrErrorOverlay: true,
  },
  buildOptions: {},
  mount: {
    public: "/",
    src: "/_dist_",
  },
  alias: {
    "@": "./src",
    "@type": "./types",
  },
};
