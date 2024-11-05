import './globals.css'

export const metadata = {
  title: '网页预览工具',
  description: '在线网页预览工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}