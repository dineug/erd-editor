module.exports = {
  css: {
    loaderOptions: {
      sass: {
        data: `
          @import "@/scss/color.scss";
          @import "@/scss/size.scss";
        `
      }
    }
  }
}
