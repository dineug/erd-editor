const autoprefixer = require("autoprefixer");

module.exports = {
  css: {
    loaderOptions: {
      sass: {
        prependData: `
          @import "@/scss/color.scss";
          @import "@/scss/size.scss";
        `
      },
      postcss: {
        plugins: [autoprefixer()]
      }
    }
  }
};
