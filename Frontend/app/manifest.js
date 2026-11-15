// Installable web app (feature list "Mobile Application", "Guardian & Student Mobile App";
// SRS v3 GDX-09: mobile-responsive portal). Guardians and teachers can add the portal to
// their home screen and open it full-screen like an app.
export default function manifest() {
  return {
    name: "Smart Educational Institute Management System",
    short_name: "Smart EIMS",
    description: "Guardian, teacher and office portal: attendance, results, fees, notices and more.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8fb",
    theme_color: "#1d4ed8",
    lang: "bn",
    categories: ["education", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
