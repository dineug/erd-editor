/**
 * The analytics script index.html runs in production. Matching a path in any
 * case or encoding, it loads nothing on /gdrive or /api/auth, for Limited Use,
 * and names an /embed page by its path alone, as address or as referrer.
 */
export function gtagSnippet(id: string): string {
  return `
      function gtagLowerPath(path) {
        try {
          path = decodeURI(path);
        } catch (error) {}
        return path.toLowerCase();
      }
      function gtagIsEmbed(path) {
        return path === '/embed' || path.startsWith('/embed/');
      }
      var gtagPath = gtagLowerPath(location.pathname);
      if (!gtagPath.startsWith('/gdrive') && !gtagPath.startsWith('/api/auth')) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          window.dataLayer.push(arguments);
        };
        window.gtag('js', new Date());
        var gtagEmbed = location.origin + '/embed';
        var gtagReferrer = document.referrer.split('?')[0].split('#')[0];
        var gtagConfig;
        if (gtagIsEmbed(gtagPath)) {
          gtagConfig = { page_location: gtagEmbed };
        }
        if (
          gtagReferrer.indexOf(location.origin + '/') === 0 &&
          gtagIsEmbed(gtagLowerPath(gtagReferrer.slice(location.origin.length)))
        ) {
          gtagConfig = gtagConfig || {};
          gtagConfig.page_referrer = gtagEmbed;
        }
        if (gtagConfig) {
          window.gtag('config', '${id}', gtagConfig);
        } else {
          window.gtag('config', '${id}');
        }
        var gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=${id}';
        document.head.appendChild(gtagScript);
      }
    `;
}
