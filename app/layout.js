import './globals.css';

export const metadata = {
  title: '9Router Quotas',
  description: 'Production quota and live model monitor for 9Router',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '9Router Quotas',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <div className="dashboard-viewport">
          {children}
        </div>
      </body>
    </html>
  );
}
