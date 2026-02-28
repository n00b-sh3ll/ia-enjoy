import '../styles/globals.css'

export const metadata = {
  title: 'Wazuh Alerts Dashboard',
  description: 'Monitor de alertas do Wazuh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  )
}
