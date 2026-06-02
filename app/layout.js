import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "PurrfectCare — Cat Care Assistant",
  description: "A feline care assistant: daily logging, health trends, food & care guidance, and a knowledge-grounded chat. Guidance, not diagnosis.",
};

export default function RootLayout({ children }){
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
