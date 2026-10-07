import './globals.css';

export const metadata = {
  title: "DentFlow Bot Platform",
  description: "Telegram Bot integration for DentFlow clinics",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
