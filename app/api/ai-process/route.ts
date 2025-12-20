import { NextRequest, NextResponse } from 'next/server'

type ActionType = 'summary' | 'thesis' | 'telegram'

interface PromptConfig {
  systemMessage: string
  userMessage: string
  temperature: number
  maxTokens: number
}

function getPromptConfig(action: ActionType, content: string): PromptConfig {
  const configs: Record<ActionType, PromptConfig> = {
    summary: {
      systemMessage: 'Ты опытный аналитик и журналист. Твоя задача - создать краткое, но информативное содержание статьи на русском языке.',
      userMessage: `Создай краткое содержание следующей статьи (2-3 абзаца), выделив основные идеи и ключевые моменты. Ответ должен быть на русском языке:\n\n${content}`,
      temperature: 0.5,
      maxTokens: 2000,
    },
    thesis: {
      systemMessage: 'Ты эксперт по анализу текстов. Твоя задача - выделить основные тезисы статьи в структурированном виде на русском языке.',
      userMessage: `Выдели основные тезисы следующей статьи. Представь их в виде пронумерованного списка, где каждый пункт - это отдельный тезис. Ответ должен быть на русском языке:\n\n${content}`,
      temperature: 0.4,
      maxTokens: 2500,
    },
    telegram: {
      systemMessage: 'Ты копирайтер, специализирующийся на создании постов для Telegram. Твоя задача - создать привлекательный и информативный пост на русском языке.',
      userMessage: `Создай пост для Telegram канала на основе следующей статьи. Пост должен быть:\n- Привлекательным и цепляющим\n- Содержать основные идеи статьи\n- Использовать эмодзи для визуального оформления\n- Иметь призыв к действию\n- Быть структурированным (заголовок, основной текст, хэштеги)\n\nОтвет должен быть на русском языке.\n\nСтатья:\n${content}`,
      temperature: 0.7,
      maxTokens: 3000,
    },
  }

  return configs[action]
}

export async function POST(request: NextRequest) {
  try {
    const { content, action } = await request.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Контент обязателен' },
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

    // Отправляем запрос к OpenRouter API
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
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenRouter API error:', errorData)
      return NextResponse.json(
        { error: `Ошибка API OpenRouter: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: 'Неожиданный формат ответа от API' },
        { status: 500 }
      )
    }

    const result = data.choices[0].message.content

    return NextResponse.json({
      result: result,
    })
  } catch (error) {
    console.error('Ошибка AI-обработки:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка при AI-обработке' },
      { status: 500 }
    )
  }
}

