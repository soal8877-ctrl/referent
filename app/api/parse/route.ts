import { NextRequest, NextResponse } from 'next/server'

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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Не удалось загрузить страницу: ${response.statusText}` },
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
        // Удаляем ненужные элементы (скрипты, стили, реклама)
        found.find('script, style, nav, header, footer, aside, .ad, .advertisement, [class*="ad"]').remove()
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
        mainContent.find('script, style, nav, header, footer, aside, .ad').remove()
        content = mainContent.text().trim()
      }
    }

    // Очищаем контент от лишних пробелов и переносов строк
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
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
