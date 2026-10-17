import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { StoreProvider } from "@/components/store";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-cairo",
});

const themeBoot = `
try {
  var raw = localStorage.getItem("focus3.v1");
  var theme = "system";
  if (raw) {
    var data = JSON.parse(raw);
    if (data.settings && data.settings.theme) theme = data.settings.theme;
  }
  var dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
} catch (e) {}
`;

export const metadata: Metadata = {
  title: {
    default: "Focus 3",
    template: "%s",
  },
  description: "أهم ٣ مهام في اليوم، وجلسات تركيز عميق مدة ٣٠ دقيقة.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
