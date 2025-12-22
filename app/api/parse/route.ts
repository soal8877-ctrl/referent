import { NextRequest, NextResponse } from 'next/server'
import type * as cheerio from 'cheerio'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL обязателен' },
        { status: 400 }
      )
    }

    // Получаем HTML страницы
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(30000), // Таймаут 30 секунд
      })
    } catch (error) {
      // Обработка ошибок сети и таймаутов
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
        return NextResponse.json(
          { error: 'TIMEOUT', message: 'Не удалось загрузить статью по этой ссылке.' },
          { status: 408 }
        )
      }
      return NextResponse.json(
        { error: 'NETWORK_ERROR', message: 'Не удалось загрузить статью по этой ссылке.' },
        { status: 500 }
      )
    }

    if (!response.ok) {
      // Обработка различных HTTP ошибок
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Не удалось загрузить статью по этой ссылке.' },
          { status: 404 }
        )
      }
      if (response.status >= 500) {
        return NextResponse.json(
          { error: 'SERVER_ERROR', message: 'Не удалось загрузить статью по этой ссылке.' },
          { status: response.status }
        )
      }
      return NextResponse.json(
        { error: 'LOAD_ERROR', message: 'Не удалось загрузить статью по этой ссылке.' },
        { status: response.status }
      )
    }

    const html = await response.text()
    // Используем require для cheerio в серверном окружении
    const cheerio = require('cheerio')
    const $ = cheerio.load(html)

    // Извлекаем заголовок
    let title = ''
    const titleSelectors = [
      'h1',
      'article h1',
      '.post-title',
      '.article-title',
      '[class*="title"]',
      'title',
    ]
    
    for (const selector of titleSelectors) {
      const found = $(selector).first().text().trim()
      if (found && found.length > 10) {
        title = found
        break
      }
    }

    // Если не нашли, берем из <title>
    if (!title) {
      title = $('title').text().trim()
    }

    // Извлекаем дату
    let date = ''
    const dateSelectors = [
      'time[datetime]',
      'time',
      '[class*="date"]',
      '[class*="published"]',
      '[class*="time"]',
      'article time',
      '.post-date',
      '.article-date',
      '[itemprop="datePublished"]',
    ]

    for (const selector of dateSelectors) {
      const element = $(selector).first()
      if (element.length) {
        // Пробуем взять из атрибута datetime
        date = element.attr('datetime') || element.text().trim()
        if (date) break
      }
    }

    // Извлекаем основной контент
    let content = ''
    const contentSelectors = [
      'article',
      '.post',
      '.content',
      '.article-content',
      '.post-content',
      '[class*="article"]',
      '[class*="post"]',
      'main article',
      '[role="article"]',
    ]

    for (const selector of contentSelectors) {
      const found = $(selector).first()
      if (found.length) {
        // Удаляем все ненужные элементы (скрипты, стили, навигация, реклама, формы и т.д.)
        const elementsToRemove = 'script, style, nav, header, footer, aside, .ad, .advertisement, [class*="ad"], [id*="ad"], form, button, input, select, textarea, .menu, .navigation, .sidebar, .widget, .social, .share, .comments, .related, iframe, embed, object, video, audio, [class*="menu"], [class*="nav"], [class*="widget"], [class*="social"], [class*="share"], [class*="comment"], [style], [class*="style"], [class*="css"], [id*="style"], [id*="css"]'
        found.find(elementsToRemove).remove()
        
        // Удаляем все элементы с inline стилями
        found.find('*').each((_: number, element: cheerio.Element) => {
          const $el = $(element)
          if ($el.attr('style') || $el.hasClass('style') || $el.hasClass('css')) {
            $el.remove()
          }
        })
        
        // Извлекаем только текстовый контент (метод .text() автоматически удаляет все HTML теги)
        content = found.text().trim()
        if (content && content.length > 100) {
          break
        }
      }
    }

    // Если не нашли в специальных селекторах, пробуем main или body
    if (!content || content.length < 100) {
      const mainContent = $('main').first()
      if (mainContent.length) {
        const elementsToRemove = 'script, style, nav, header, footer, aside, .ad, .advertisement, [class*="ad"], [id*="ad"], form, button, input, select, textarea, .menu, .navigation, .sidebar, .widget, .social, .share, .comments, .related, iframe, embed, object, video, audio, [style], [class*="style"], [class*="css"]'
        mainContent.find(elementsToRemove).remove()
        
        // Удаляем все элементы с inline стилями
        mainContent.find('*').each((_: number, element: cheerio.Element) => {
          const $el = $(element)
          if ($el.attr('style') || $el.hasClass('style') || $el.hasClass('css')) {
            $el.remove()
          }
        })
        
        content = mainContent.text().trim()
      }
    }

    // Очищаем контент от CSS кода и лишних символов
    content = content
      // Удаляем CSS паттерны
      .replace(/:host\([^)]*\)/g, '')           // :host(...)
      .replace(/:host\s*\{[^}]*\}/g, '')        // :host { ... }
      .replace(/::slotted\([^)]*\)/g, '')       // ::slotted(...)
      .replace(/@media\s*\([^)]*\)\s*\{[^}]*\}/g, '') // @media(...) { ... }
      .replace(/@[a-z-]+\s*\{[^}]*\}/g, '')     // @правило { ... }
      .replace(/\[part~="[^"]*"\]/g, '')        // [part~="..."]
      .replace(/\[part="[^"]*"\]/g, '')         // [part="..."]
      .replace(/\[role="[^"]*"\]/g, '')         // [role="..."]
      .replace(/[a-z-]+\s*\{[^}]*\}/g, '')      // селектор { ... }
      .replace(/--[a-z-]+:\s*[^;]+;/g, '')       // CSS переменные --var: value;
      .replace(/var\(--[^)]+\)/g, '')           // var(--...)
      .replace(/calc\([^)]+\)/g, '')            // calc(...)
      .replace(/rgb\([^)]+\)/g, '')             // rgb(...)
      .replace(/rgba\([^)]+\)/g, '')            // rgba(...)
      .replace(/#[0-9a-f]{3,6}/gi, '')          // hex цвета
      .replace(/[a-z-]+:\s*[^;]+;/g, '')        // свойство: значение;
      .replace(/\s+/g, ' ')                     // Заменяем множественные пробелы на один
      .replace(/\n\s*\n\s*\n/g, '\n\n')         // Удаляем множественные переносы строк
      .replace(/&nbsp;/g, ' ')                  // Заменяем HTML сущности
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/gi, '')                // Удаляем остальные HTML сущности
      // Удаляем строки, которые выглядят как CSS (содержат только CSS синтаксис)
      .split('\n')
      .filter(line => {
        const trimmed = line.trim()
        // Пропускаем строки, которые выглядят как CSS
        if (!trimmed || trimmed.length === 0) return false
        if (/^[:@#\[].*\{.*\}$/.test(trimmed)) return false // CSS селекторы
        if (/^[a-z-]+:\s*[^;]+;$/.test(trimmed)) return false // CSS свойства
        if (/^--[a-z-]+:/.test(trimmed)) return false // CSS переменные
        if (/^@[a-z]+/.test(trimmed)) return false // @правила
        return true
      })
      .join('\n')
      .trim()

    return NextResponse.json({
      date: date || 'Дата не найдена',
      title: title || 'Заголовок не найден',
      content: content || 'Контент не найден',
    })
  } catch (error) {
    console.error('Ошибка парсинга:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка при парсинге' },
      { status: 500 }
    )
  }
}
