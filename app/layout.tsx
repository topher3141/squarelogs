import "./globals.css";

export const metadata = {
  title: "Deals & Steals Receipt & Video Search",
  description: "Search Square receipts and open matching UniFi Protect footage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
