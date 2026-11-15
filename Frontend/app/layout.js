import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/500.css";
import "@fontsource/noto-sans-bengali/600.css";
import "@fontsource/noto-sans-bengali/700.css";
import "@fontsource/noto-sans-bengali/800.css";
import "@fontsource/noto-sans-bengali/900.css";
import "./globals.css";
import { ToastProvider } from "./components/ui/kit";
import PwaRegister from "./components/PwaRegister";

export const metadata = {
  title: "Smart Educational Institute Management System",
  applicationName: "Smart EIMS",
  appleWebApp: { capable: true, title: "Smart EIMS", statusBarStyle: "default" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
  description: "School, college, madrasa (Alia & Qawmi), Bangla & English medium institution management: admission, students, ID cards, attendance, exams, fees, accounts, HR and portals.",
};

export const viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
