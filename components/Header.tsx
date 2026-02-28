"use client"

import { useEffect, useState } from 'react'

export default function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'dark' | 'light' | null) || 'dark'
    setTheme(saved)
    if (saved === 'light') {
      document.body.classList.add('theme-light')
    } else {
      document.body.classList.remove('theme-light')
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)

    if (nextTheme === 'light') {
      document.body.classList.add('theme-light')
    } else {
      document.body.classList.remove('theme-light')
    }
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 shadow-sm">
      <div className="container py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-blue-600" />
          <h1 className="text-lg font-bold text-slate-100">Wazuh Alerts</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="px-3 py-1 text-xs border border-slate-600 rounded bg-slate-800 text-slate-100 hover:bg-slate-700 transition"
            title="Alternar tema"
          >
            {theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}
          </button>
          <a href="/dashboard" className="text-sm text-slate-300 hover:text-white transition">Dashboard</a>
          <a href="/detalhes" className="text-sm text-slate-300 hover:text-white transition">Detalhes</a>
        </div>
      </div>
    </header>
  )
}
