import { NextRequest, NextResponse } from 'next/server'

type ActionType = 'summary' | 'thesis' | 'telegram'

interface PromptConfig {
  systemMessage: string
  userMessage: string
  temperature: number
  maxTokens: number
}

// Примерная оценка: 1 токен ≈ 4 символа для английского текста
// Для безопасности используем коэффициент 3
const CHARS_PER_TOKEN = 3
const MAX_CONTENT_LENGTH = 20000 // Примерно 6000-7000 токенов
const API_TIMEOUT = 60000 // 60 секунд

/**
 * Разбивает длинный контент на части для обработки
 */
function splitContent(content: string, maxLength: number = MAX_CONTENT_LENGTH): string[] {
  if (content.length <= maxLength) {
    return [content]
  }

  const chunks: string[] = []
  let currentIndex = 0

  while (currentIndex < content.length) {
    const chunk = content.slice(currentIndex, currentIndex + maxLength)
    
    // Пытаемся разбить по предложениям для более естественного разбиения
    const lastPeriod = chunk.lastIndexOf('.')
    const lastNewline = chunk.lastIndexOf('\n')
    const splitPoint = Math.max(lastPeriod, lastNewline)
    
    if (splitPoint > maxLength * 0.5) {
      // Если нашли хорошую точку разбиения (не слишком близко к началу)
      chunks.push(chunk.slice(0, splitPoint + 1))
      currentIndex += splitPoint + 1
    } else {
      // Иначе просто берем кусок фиксированной длины
      chunks.push(chunk)
      currentIndex += maxLength
    }
  }

  return chunks
}

/**
 * Обрабатывает длинный контент, разбивая его на части
 */
async function processLongContent(
  content: string,
  action: ActionType,
  apiKey: string,
  promptConfig: PromptConfig
): Promise<string> {
  const chunks = splitContent(content)
  
  if (chunks.length === 1) {
    // Если контент короткий, обрабатываем как обычно
    return await callOpenRouterAPI(chunks[0], action, apiKey, promptConfig)
  }

  // Для длинных статей обрабатываем первую часть и делаем краткое резюме остальных
  const firstChunk = chunks[0]
  const remainingChunks = chunks.slice(1).join('\n\n[...продолжение статьи...]\n\n')
  
  // Обрабатываем первую часть
  const firstPartResult = await callOpenRouterAPI(firstChunk, action, apiKey, promptConfig)
  
  // Если есть остальные части, добавляем информацию о них
  if (chunks.length > 1) {
    return `${firstPartResult}\n\n[Примечание: статья была сокращена для обработки. Показаны результаты анализа первой части статьи.]`
  }
  
  return firstPartResult
}

/**
 * Вызывает OpenRouter API с таймаутом
 */
async function callOpenRouterAPI(
  content: string,
  action: ActionType,
  apiKey: string,
  promptConfig: PromptConfig
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Referent App',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: promptConfig.systemMessage,
          },
          {
            role: 'user',
            content: promptConfig.userMessage,
          },
        ],
        temperature: promptConfig.temperature,
        max_tokens: promptConfig.maxTokens,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.text()
      let errorMessage = `Ошибка API OpenRouter: ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorData)
        if (errorJson.error?.message) {
          errorMessage = `Ошибка API: ${errorJson.error.message}`
        }
      } catch {
        // Если не удалось распарсить JSON, используем текст ошибки
        if (errorData) {
          errorMessage = `Ошибка API: ${errorData.substring(0, 200)}`
        }
      }
      
      throw new Error(errorMessage)
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Неожиданный формат ответа от API')
    }

    return data.choices[0].message.content || ''
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа от API. Попробуйте позже или сократите текст статьи.')
    }
    
    throw error
  }
}

function getPromptConfig(action: ActionType, content: string): PromptConfig {
  const configs: Record<ActionType, PromptConfig> = {
    summary: {
      systemMessage: 'Ты опытный аналитик и журналист. Твоя задача - создать краткое, но информативное содержание статьи. Твой ответ должен быть структурированным, понятным и содержать только ключевые идеи статьи.',
      userMessage: `Создай краткое содержание следующей статьи (2-3 абзаца), выделив основные идеи и ключевые моменты. Ответ должен быть на русском языке, информативным и легко читаемым:\n\n${content}`,
      temperature: 0.5,
      maxTokens: 2000,
    },
    thesis: {
      systemMessage: 'Ты эксперт по анализу текстов. Твоя задача - выделить основные тезисы статьи в структурированном виде. Каждый тезис должен быть самостоятельным утверждением, отражающим важную мысль из статьи.',
      userMessage: `Выдели основные тезисы следующей статьи. Представь их в виде пронумерованного списка, где каждый пункт - это отдельный тезис. Тезисы должны быть краткими, но информативными. Ответ должен быть на русском языке:\n\n${content}`,
      temperature: 0.4,
      maxTokens: 2500,
    },
    telegram: {
      systemMessage: 'Ты копирайтер, специализирующийся на создании постов для Telegram. Твоя задача - создать привлекательный и информативный пост. Пост должен быть структурированным, использовать эмодзи для визуального оформления и иметь призыв к действию.',
      userMessage: `Создай пост для Telegram канала на основе следующей статьи. Пост должен быть:\n- Привлекательным и цепляющим с самого начала\n- Содержать основные идеи статьи в сжатом виде\n- Использовать эмодзи для визуального оформления (но не переборщить)\n- Иметь призыв к действию в конце\n- Быть структурированным: заголовок (можно с эмодзи), основной текст, хэштеги в конце\n- Легко читаться и быть интересным\n\nОтвет должен быть на русском языке.\n\nСтатья:\n${content}`,
      temperature: 0.7,
      maxTokens: 3000,
    },
  }

  return configs[action]
}

export async function POST(request: NextRequest) {
  try {
    const { content, action } = await request.json()

    // Валидация входных данных
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Контент обязателен' },
        { status: 400 }
      )
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Контент не может быть пустым' },
        { status: 400 }
      )
    }

    if (!action || !['summary', 'thesis', 'telegram'].includes(action)) {
      return NextResponse.json(
        { error: 'Действие должно быть одним из: summary, thesis, telegram' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API ключ OpenRouter не настроен. Добавьте OPENROUTER_API_KEY в .env.local' },
        { status: 500 }
      )
    }

    // Получаем конфигурацию промпта для выбранного действия
    const promptConfig = getPromptConfig(action as ActionType, content)

    // Обрабатываем контент (с поддержкой длинных статей)
    let result: string
    
    if (content.length > MAX_CONTENT_LENGTH) {
      // Для очень длинных статей используем специальную обработку
      result = await processLongContent(content, action as ActionType, apiKey, promptConfig)
    } else {
      // Для обычных статей обрабатываем напрямую
      result = await callOpenRouterAPI(content, action as ActionType, apiKey, promptConfig)
    }

    if (!result || result.trim().length === 0) {
      return NextResponse.json(
        { error: 'Получен пустой ответ от AI. Попробуйте еще раз.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      result: result,
    })
  } catch (error) {
    console.error('Ошибка AI-обработки:', error)
    
    // Более детальная обработка ошибок
    let errorMessage = 'Неизвестная ошибка при AI-обработке'
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Специальная обработка для сетевых ошибок
      if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету и попробуйте позже.'
      }
      
      // Обработка ошибок таймаута
      if (error.message.includes('время ожидания') || error.message.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа. Статья слишком длинная или сервер перегружен. Попробуйте позже.'
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

