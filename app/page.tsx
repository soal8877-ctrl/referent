'use client'

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeButton, setActiveButton] = useState<string | null>(null)
  const [processingStage, setProcessingStage] = useState<'parsing' | 'ai' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (action: 'summary' | 'thesis' | 'telegram') => {
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    setLoading(true)
    setActiveButton(action)
    setResult('')
    setError(null)
    setProcessingStage('parsing')

    try {
      // Шаг 1: Парсим статью
      const parseResponse = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json()
        // Используем дружественное сообщение из API или стандартное
        const errorMessage = errorData.message || 'Не удалось загрузить статью по этой ссылке.'
        throw { type: 'parse', message: errorMessage, code: errorData.error }
      }

      const parseData = await parseResponse.json()
      
      // Шаг 2: Валидация наличия контента после парсинга
      if (!parseData.content || parseData.content === 'Контент не найден') {
        throw { type: 'parse', message: 'Не удалось извлечь контент статьи. Проверьте URL и попробуйте снова.', code: 'NO_CONTENT' }
      }

      // Переключаемся на этап AI обработки
      setProcessingStage('ai')

      // Шаг 3: Отправляем контент в API для AI-обработки
      const aiResponse = await fetch('/api/ai-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: parseData.content,
          action: action,
          sourceUrl: action === 'telegram' ? url : undefined, // Передаем URL только для telegram
        }),
      })

      if (!aiResponse.ok) {
        const errorData = await aiResponse.json()
        // Используем дружественное сообщение из API
        const errorMessage = errorData.message || 'Произошла ошибка при обработке статьи. Попробуйте позже.'
        throw { type: 'ai', message: errorMessage, code: errorData.error }
      }

      const aiData = await aiResponse.json()
      
      // Шаг 4: Выводим результат AI-обработки в поле "Результат"
      if (!aiData.result) {
        throw { type: 'ai', message: 'Результат обработки не получен. Попробуйте еще раз.', code: 'NO_RESULT' }
      }

      setResult(aiData.result)
      setError(null)
    } catch (error) {
      // Обработка ошибок с дружественными сообщениями
      if (error && typeof error === 'object' && 'message' in error) {
        setError(error.message as string)
      } else if (error instanceof Error) {
        // Для сетевых ошибок показываем дружественное сообщение
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          setError('Не удалось загрузить статью по этой ссылке.')
        } else {
          setError(error.message)
        }
      } else {
        setError('Произошла неизвестная ошибка. Попробуйте позже.')
      }
      setResult('')
      console.error('Ошибка обработки:', error)
    } finally {
      setLoading(false)
      setProcessingStage(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Перевод и анализ статей с ИИ-обработкой
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
            placeholder="Введите URL статьи, например: https://example.com/article"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
          <p className="mt-2 text-xs text-gray-500">
            Укажите ссылку на англоязычную статью
          </p>
        </div>

        {/* Кнопки действий */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleSubmit('summary')}
              disabled={loading}
              title="Получить краткое содержание статьи на русском языке"
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
              title="Выделить основные тезисы статьи в виде пронумерованного списка"
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
              title="Создать готовый пост для Telegram канала с эмодзи и хэштегами"
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

        {/* Блок статуса процесса */}
        {loading && processingStage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-sm text-blue-800">
                {processingStage === 'parsing' 
                  ? 'Загружаю статью...' 
                  : processingStage === 'ai'
                  ? activeButton === 'summary'
                    ? 'Создаю краткое содержание...'
                    : activeButton === 'thesis'
                    ? 'Выделяю тезисы...'
                    : activeButton === 'telegram'
                    ? 'Создаю пост для Telegram...'
                    : 'Обрабатываю...'
                  : 'Обработка...'}
              </p>
            </div>
          </div>
        )}

        {/* Блок ошибок */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Блок результата */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Результат
          </h2>
          <div className="min-h-[200px] p-4 bg-gray-50 rounded-md border border-gray-200">
            {loading ? (
              <p className="text-gray-400 text-center">Результат появится здесь после обработки</p>
            ) : result ? (
              <div className="text-gray-700 text-sm overflow-auto max-h-[600px]">
                {activeButton === 'thesis' ? (
                  // Для тезисов сохраняем нумерацию и структуру
                  <div className="whitespace-pre-wrap font-sans">
                    {result.split('\n').map((line, index) => {
                      // Проверяем, является ли строка нумерованным списком
                      if (/^\d+[\.\)]\s/.test(line.trim())) {
                        return (
                          <div key={index} className="mb-2 pl-4">
                            {line}
                          </div>
                        )
                      }
                      return (
                        <div key={index} className="mb-1">
                          {line}
                        </div>
                      )
                    })}
                  </div>
                ) : activeButton === 'telegram' ? (
                  // Для поста Telegram сохраняем форматирование с эмодзи
                  <div className="whitespace-pre-wrap font-sans leading-relaxed">
                    {result.split('\n').map((line, index) => {
                      // Определяем тип строки для форматирования
                      const isHeader = line.trim().length > 0 && 
                        (line.trim().startsWith('#') || 
                         index === 0 || 
                         /^[🔴🟠🟡🟢🔵🟣⚫⚪🟤].*/.test(line.trim()))
                      const isHashtag = line.trim().startsWith('#')
                      
                      if (isHashtag) {
                        return (
                          <div key={index} className="mt-3 text-blue-600 font-medium">
                            {line}
                          </div>
                        )
                      } else if (isHeader) {
                        return (
                          <div key={index} className="mb-3 text-lg font-semibold">
                            {line}
                          </div>
                        )
                      }
                      return (
                        <div key={index} className="mb-2">
                          {line}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Для остальных (summary, translate) - читабельные абзацы
                  <div className="whitespace-pre-wrap font-sans leading-relaxed">
                    {result.split('\n\n').map((paragraph, index) => (
                      <p key={index} className="mb-4 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-center">Результат появится здесь после обработки</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
