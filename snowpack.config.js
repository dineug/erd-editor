module.exports = {
  plugins: ["@snowpack/plugin-typescript"],
  mount: {
    public: "/",
    src: "/_dist_",
  },
  alias: {
    "@": "./src",
    "@type": "./types",
  },
};
