/* Where the learning website is. Behind the lab gateway the app is at <site>/app/, so the website is one folder up;
   anywhere else (for example the Windows app) the public website is used. */
const PUBLIC_SITE = 'https://alevaldo05.github.io/Biomaterials-Tensile-Tester/';
export function siteUrl(page = ''): string {
  const underApp = typeof location !== 'undefined' && /\/app\/(index\.html)?$/.test(location.pathname);
  return (underApp ? '../' : PUBLIC_SITE) + page;
}
