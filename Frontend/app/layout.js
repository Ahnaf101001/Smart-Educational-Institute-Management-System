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

export const metadata = {
  title: "Smart Educational Institute Management System",
  description: "School, college, madrasa (Alia & Qawmi), Bangla & English medium institution management: admission, students, ID cards, attendance, exams, fees, accounts, HR and portals.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
