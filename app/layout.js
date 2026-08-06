export const metadata = {
  title: 'Rua Sadiq API',
  description: 'Backend API for Rua Sadiq Trading',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
