'use client'

import { useState } from 'react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeButton, setActiveButton] = useState<string | null>(null)

  const handleParse = async () => {
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    setLoading(true)
    setResult('')

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка парсинга')
      }

      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (action: 'summary' | 'thesis' | 'telegram') => {
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    setLoading(true)
    setActiveButton(action)
    setResult('')

    // Сначала парсим статью
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка парсинга')
      }

      const data = await response.json()
      // Показываем результат парсинга
      setResult(JSON.stringify(data, null, 2))
      
      // Здесь будет логика обработки AI (пока просто показываем парсинг)
      // TODO: Добавить обработку AI для каждого типа действия
    } catch (error) {
      setResult(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Анализ статей
        </h1>

        {/* Поле ввода URL */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            URL англоязычной статьи
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>

        {/* Кнопка парсинга */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <button
            onClick={handleParse}
            disabled={loading}
            className="w-full px-6 py-3 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Парсинг...' : 'Распарсить статью'}
          </button>
        </div>

        {/* Кнопки действий */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleSubmit('summary')}
              disabled={loading}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeButton === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && activeButton === 'summary' ? 'Обработка...' : 'О чем статья?'}
            </button>

            <button
              onClick={() => handleSubmit('thesis')}
              disabled={loading}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeButton === 'thesis'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && activeButton === 'thesis' ? 'Обработка...' : 'Тезисы'}
            </button>

            <button
              onClick={() => handleSubmit('telegram')}
              disabled={loading}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeButton === 'telegram'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && activeButton === 'telegram' ? 'Обработка...' : 'Пост для Telegram'}
            </button>
          </div>
        </div>

        {/* Блок результата */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Результат
          </h2>
          <div className="min-h-[200px] p-4 bg-gray-50 rounded-md border border-gray-200">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : result ? (
              <pre className="text-gray-700 whitespace-pre-wrap text-sm overflow-auto max-h-[600px]">{result}</pre>
            ) : (
              <p className="text-gray-400 text-center">Результат появится здесь после обработки</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
