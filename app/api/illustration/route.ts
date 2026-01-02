import { NextRequest, NextResponse } from 'next/server'

const API_TIMEOUT = 120000 // 120 секунд для генерации изображения

/**
 * Генерирует промпт для изображения на основе статьи через OpenRouter
 */
async function generateImagePrompt(content: string, apiKey: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 секунд для промпта

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
            content: 'Ты помощник для создания промптов для генерации изображений. Создай краткий, но детальный промпт на английском языке для генерации иллюстрации к статье. Промпт должен описывать ключевую визуальную концепцию статьи, быть конкретным и подходящим для text-to-image модели. Верни только промпт, без дополнительных объяснений.',
          },
          {
            role: 'user',
            content: `Создай промпт для генерации изображения на основе следующей статьи:\n\n${content.substring(0, 10000)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
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
        if (errorData) {
          errorMessage = `Ошибка API: ${errorData.substring(0, 200)}`
        }
      }
      
      throw new Error(errorMessage)
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Неожиданный формат ответа от API OpenRouter')
    }

    return data.choices[0].message.content.trim()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Таймаут при генерации промпта')
      }
      throw error
    }
    throw new Error('Неизвестная ошибка при генерации промпта')
  }
}

/**
 * Генерирует изображение через Hugging Face Inference API
 */
async function generateImage(prompt: string, hfApiKey: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

  try {
    // Используем популярную модель Stable Diffusion через Hugging Face
    const modelName = 'stabilityai/stable-diffusion-xl-base-1.0'
    
    // Используем правильный формат endpoint для нового API
    const endpoint = `https://router.huggingface.co/hf-inference/models/${modelName}`
    
    const response = await fetch(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hfApiKey}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 30,
            guidance_scale: 7.5,
          },
        }),
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.text()
      let errorMessage = `Ошибка API Hugging Face: ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorData)
        if (errorJson.error) {
          errorMessage = `Ошибка API: ${errorJson.error}`
        }
      } catch {
        if (errorData) {
          errorMessage = `Ошибка API: ${errorData.substring(0, 200)}`
        }
      }
      
      throw new Error(errorMessage)
    }

    // Hugging Face возвращает изображение в формате blob
    const imageBlob = await response.blob()
    
    // Конвертируем blob в base64 для передачи через JSON
    const arrayBuffer = await imageBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    
    // Определяем MIME тип
    const mimeType = imageBlob.type || 'image/png'
    
    return `data:${mimeType};base64,${base64Image}`
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Таймаут при генерации изображения')
      }
      throw error
    }
    throw new Error('Неизвестная ошибка при генерации изображения')
  }
}

export async function POST(request: NextRequest) {
  // Блокировка отправки запроса
  return NextResponse.json(
    { 
      error: 'Генерация иллюстраций временно отключена',
      message: 'Генерация иллюстраций временно отключена'
    },
    { status: 503 }
  )
  
  /* Закомментировано для блокировки запросов
  try {
    const { content } = await request.json()

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

    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    const hfApiKey = process.env.HUGGINGFACE_API_KEY

    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'API ключ OpenRouter не настроен. Добавьте OPENROUTER_API_KEY в .env.local' },
        { status: 500 }
      )
    }

    if (!hfApiKey) {
      return NextResponse.json(
        { error: 'API ключ Hugging Face не настроен. Добавьте HUGGINGFACE_API_KEY в .env.local' },
        { status: 500 }
      )
    }

    // Шаг 1: Генерируем промпт для изображения
    const imagePrompt = await generateImagePrompt(content, openRouterApiKey)
    
    if (!imagePrompt || imagePrompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Не удалось сгенерировать промпт для изображения' },
        { status: 500 }
      )
    }

    // Шаг 2: Генерируем изображение
    const imageDataUrl = await generateImage(imagePrompt, hfApiKey)

    return NextResponse.json({
      success: true,
      prompt: imagePrompt,
      image: imageDataUrl,
    })
  } catch (error) {
    console.error('Ошибка генерации иллюстрации:', error)
    
    let errorMessage = 'Произошла ошибка при генерации иллюстрации'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message
      
      if (error.message.includes('таймаут') || error.message.includes('timeout')) {
        statusCode = 408
      } else if (error.message.includes('API ключ')) {
        statusCode = 500
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        message: errorMessage 
      },
      { status: statusCode }
    )
  }
  */
}

