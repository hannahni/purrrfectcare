import "./globals.css";

export const metadata = {
  title: "PurrfectCare — Cat Care Assistant",
  description: "A feline care assistant: daily logging, health trends, food & care guidance, and a knowledge-grounded chat. Guidance, not diagnosis.",
};

export default function RootLayout({ children }){
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
