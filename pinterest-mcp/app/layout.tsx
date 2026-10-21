export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, background: '#f7f7f5', color: '#161616' }}>
        {children}
      </body>
    </html>
  );
}
