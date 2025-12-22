'use client'

import { useState, useRef, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { AlertCircle, Copy, X, History, Trash2, Sun, Moon } from 'lucide-react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeButton, setActiveButton] = useState<string | null>(null)
  const [processingStage, setProcessingStage] = useState<'parsing' | 'ai' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [urlHistory, setUrlHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  // Загрузка темы из localStorage при монтировании
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark)
    
    setIsDark(isDarkMode)
    
    // Убеждаемся, что класс применен (на случай если скрипт в layout.tsx еще не выполнился)
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Загрузка истории из localStorage при монтировании
  useEffect(() => {
    const savedHistory = localStorage.getItem('urlHistory')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setUrlHistory(Array.isArray(parsed) ? parsed : [])
      } catch (e) {
        console.error('Ошибка загрузки истории:', e)
        setUrlHistory([])
      }
    }
  }, [])

  // Переключение темы
  const toggleTheme = () => {
    const newTheme = !isDark
    
    // Применяем класс к html элементу сразу
    if (newTheme) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
    
    // Обновляем состояние после применения класса
    setIsDark(newTheme)
  }

  // Сохранение URL в историю
  const saveToHistory = (urlToSave: string) => {
    if (!urlToSave.trim()) return
    
    setUrlHistory((prev) => {
      // Удаляем дубликаты и добавляем в начало
      const filtered = prev.filter((item) => item !== urlToSave)
      const newHistory = [urlToSave, ...filtered].slice(0, 10) // Максимум 10 элементов
      
      // Сохраняем в localStorage
      localStorage.setItem('urlHistory', JSON.stringify(newHistory))
      
      return newHistory
    })
  }

  // Удаление URL из истории
  const removeFromHistory = (urlToRemove: string) => {
    setUrlHistory((prev) => {
      const newHistory = prev.filter((item) => item !== urlToRemove)
      localStorage.setItem('urlHistory', JSON.stringify(newHistory))
      return newHistory
    })
  }

  // Очистка всей истории
  const clearHistory = () => {
    setUrlHistory([])
    localStorage.removeItem('urlHistory')
  }

  // Выбор URL из истории
  const selectFromHistory = (selectedUrl: string) => {
    setUrl(selectedUrl)
    setShowHistory(false)
  }

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
      
      // Сохраняем URL в историю после успешной обработки
      saveToHistory(url)
      
      // Автоматическая прокрутка к результатам после успешной генерации
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
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

  const handleClear = () => {
    setUrl('')
    setResult('')
    setError(null)
    setLoading(false)
    setActiveButton(null)
    setProcessingStage(null)
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!result) return
    
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Ошибка копирования:', err)
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = result
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackErr) {
        console.error('Ошибка копирования (fallback):', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 text-center sm:text-left flex-1 px-2">
            Перевод и анализ статей с ИИ-обработкой
          </h1>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            title={isDark ? "Переключить на светлую тему" : "Переключить на темную тему"}
            aria-label="Переключить тему"
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>
        </div>

        {/* Поле ввода URL */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Укажите ссылку на англоязычную статью:
            </label>
            <button
              onClick={handleClear}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              title="Очистить все поля и результаты"
            >
              <X className="h-4 w-4" />
              Очистить
            </button>
          </div>
          
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Введите URL статьи, например: https://example.com/article"
            className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm sm:text-base mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          />
          
          {/* Кнопка истории */}
          {urlHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors w-full sm:w-auto"
              title={showHistory ? "Скрыть историю URL" : "Показать историю URL"}
            >
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>История последних ссылок: {urlHistory.length}</span>
            </button>
          )}
          
          {/* Панель истории */}
          {showHistory && urlHistory.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">История URL ({urlHistory.length})</h3>
                <button
                  onClick={clearHistory}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Очистить всю историю"
                >
                  Очистить всё
                </button>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {urlHistory.map((historyUrl, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
                  >
                    <button
                      onClick={() => selectFromHistory(historyUrl)}
                      className="flex-1 text-left text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 break-all pr-2"
                      title="Выбрать этот URL"
                    >
                      {historyUrl}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFromHistory(historyUrl)
                      }}
                      className="flex-shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Удалить из истории"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <button
              onClick={() => handleSubmit('summary')}
              disabled={loading}
              title="Получить краткое содержание статьи на русском языке"
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-md font-medium transition-all text-sm sm:text-base ${
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
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-md font-medium transition-all text-sm sm:text-base ${
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
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-md font-medium transition-all text-sm sm:text-base ${
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
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-600 dark:border-blue-400 flex-shrink-0"></div>
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 break-words">
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
          <Alert variant="destructive" className="mb-4 sm:mb-6">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        {/* Блок результата */}
        <div ref={resultRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              Результат:
            </h2>
            {result && !loading && (
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-md transition-colors w-full sm:w-auto"
                title="Копировать результат"
              >
                <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {copied ? 'Скопировано!' : 'Копировать'}
              </button>
            )}
          </div>
          <div className="min-h-[200px] p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
            {loading ? (
              <p className="text-gray-400 dark:text-gray-500 text-center">Результат появится здесь после обработки</p>
            ) : result ? (
              <div className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm overflow-auto max-h-[400px] sm:max-h-[600px] break-words">
                {activeButton === 'thesis' ? (
                  // Для тезисов сохраняем нумерацию и структуру
                  <div className="whitespace-pre-wrap font-sans break-words">
                    {result.split('\n').map((line, index) => {
                      // Проверяем, является ли строка нумерованным списком
                      if (/^\d+[\.\)]\s/.test(line.trim())) {
                        return (
                          <div key={index} className="mb-2 pl-2 sm:pl-4 break-words">
                            {line}
                          </div>
                        )
                      }
                      return (
                        <div key={index} className="mb-1 break-words">
                          {line}
                        </div>
                      )
                    })}
                  </div>
                ) : activeButton === 'telegram' ? (
                  // Для поста Telegram сохраняем форматирование с эмодзи
                  <div className="whitespace-pre-wrap font-sans leading-relaxed break-words">
                    {result.split('\n').map((line, index) => {
                      // Определяем тип строки для форматирования
                      const isHeader = line.trim().length > 0 && 
                        (line.trim().startsWith('#') || 
                         index === 0 || 
                         /^[🔴🟠🟡🟢🔵🟣⚫⚪🟤].*/.test(line.trim()))
                      const isHashtag = line.trim().startsWith('#')
                      
                      if (isHashtag) {
                        return (
                          <div key={index} className="mt-3 text-blue-600 dark:text-blue-400 font-medium break-words">
                            {line}
                          </div>
                        )
                      } else if (isHeader) {
                        return (
                          <div key={index} className="mb-3 text-base sm:text-lg font-semibold break-words text-gray-900 dark:text-gray-100">
                            {line}
                          </div>
                        )
                      }
                      return (
                        <div key={index} className="mb-2 break-words">
                          {line}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Для остальных (summary, translate) - читабельные абзацы
                  <div className="whitespace-pre-wrap font-sans leading-relaxed break-words">
                    {result.split('\n\n').map((paragraph, index) => (
                      <p key={index} className="mb-3 sm:mb-4 last:mb-0 break-words">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-center">Результат появится здесь после обработки</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
