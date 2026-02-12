export type ParsedCardDraftItem = {
    title: string
    description?: string
}

function stripBom(text: string) {
    return text.replace(/^\uFEFF/, '')
}

function normalizeNewlines(text: string) {
    return text.replace(/\r\n/g, '\n')
}

function normalizeSmartQuotes(text: string) {
    return text
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
}

function cleanMarkdown(text: string) {
    return normalizeNewlines(text)
        .replace(/\*\*/g, '')
        .replace(/^\s*[*-]\s+/gm, '')
        .trim()
}

function extractFencedContent(text: string) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    return fenced?.[1]?.trim() ?? null
}

function tryJsonParse(text: string) {
    return JSON.parse(stripBom(text.trim()))
}

function normalizeParsedToItems(parsed: unknown): ParsedCardDraftItem[] {
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    const items: ParsedCardDraftItem[] = []

    for (const item of arr) {
        const title =
            typeof item === 'object' && item !== null && 'title' in item && typeof item.title === 'string' ? item.title.trim() : ''
        const descriptionRaw = typeof item === 'object' && item !== null && 'description' in item ? item.description : undefined
        const description = typeof descriptionRaw === 'string' ? descriptionRaw.trim() : undefined
        if (title) items.push({ title, description: description || undefined })
    }

    return items
}

function extractBalancedArraySlice(text: string, startIndex: number) {
    let depth = 0
    let inString = false
    let stringQuote: '"' | "'" | null = null
    let escaped = false

    for (let i = startIndex; i < text.length; i++) {
        const ch = text[i]

        if (inString) {
            if (escaped) {
                escaped = false
                continue
            }
            if (ch === '\\') {
                escaped = true
                continue
            }
            if (stringQuote && ch === stringQuote) {
                inString = false
                stringQuote = null
            }
            continue
        }

        if (ch === '"' || ch === "'") {
            inString = true
            stringQuote = ch as '"' | "'"
            continue
        }

        if (ch === '[') {
            depth++
            continue
        }
        if (ch === ']') {
            depth--
            if (depth === 0) return text.slice(startIndex, i + 1)
            continue
        }
    }

    return null
}

function tryExtractFirstJsonArray(text: string) {
    const normalized = normalizeSmartQuotes(stripBom(text))
    let start = normalized.indexOf('[')
    while (start !== -1) {
        const slice = extractBalancedArraySlice(normalized, start)
        if (slice) {
            try {
                const parsed = JSON.parse(slice)
                if (Array.isArray(parsed)) return parsed
            } catch {
            }
        }
        start = normalized.indexOf('[', start + 1)
    }
    return null
}

export function parseCardDraftItemsFromAiContent(content: string): ParsedCardDraftItem[] {
    const normalized = stripBom(content.trim())

    try {
        const parsed = tryJsonParse(normalized)
        const items = normalizeParsedToItems(parsed)
        if (items.length > 0) return items
    } catch {
    }

    const fenced = extractFencedContent(normalized)
    if (fenced) {
        try {
            const parsed = tryJsonParse(fenced)
            const items = normalizeParsedToItems(parsed)
            if (items.length > 0) return items
        } catch {
        }
    }

    const extractedArray = tryExtractFirstJsonArray(normalized)
    if (extractedArray) {
        const items = normalizeParsedToItems(extractedArray)
        if (items.length > 0) return items
    }

    const markdownTable = parseMarkdownTableCards(normalized)
    if (markdownTable.length > 0) return markdownTable

    const kvCards = parseKeyValueCards(normalized)
    if (kvCards.length > 0) return kvCards

    const markdownCards = parseNumberedMarkdownCards(normalized)
    if (markdownCards.length > 0) return markdownCards

    throw new Error('No markdown cards found')
}

function parseMarkdownTableCards(text: string) {
    const lines = normalizeNewlines(text).split('\n')
    const items: ParsedCardDraftItem[] = []

    const isHeaderLine = (line: string) => {
        const lowered = line.toLowerCase()
        return line.includes('|') && (lowered.includes('title') || lowered.includes('description') || line.includes('标题') || line.includes('描述'))
    }
    const isSeparatorLine = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)

    for (let i = 0; i < lines.length; i++) {
        const headerLine = lines[i]
        if (!isHeaderLine(headerLine)) continue
        const separatorLine = lines[i + 1] ?? ''
        if (!isSeparatorLine(separatorLine)) continue

        const headers = headerLine
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => c.toLowerCase())

        const titleIdx = headers.findIndex((h) => h === 'title' || h.includes('标题'))
        const descIdx = headers.findIndex((h) => h === 'description' || h.includes('描述'))

        if (titleIdx === -1) continue

        for (let r = i + 2; r < lines.length; r++) {
            const row = lines[r]
            if (!row.includes('|')) break
            if (isSeparatorLine(row)) continue
            const cols = row
                .split('|')
                .map((c) => c.trim())
                .filter(Boolean)
            const rawTitle = cols[titleIdx] ?? ''
            const rawDesc = descIdx !== -1 ? cols[descIdx] ?? '' : ''
            const title = cleanMarkdown(rawTitle)
            const description = cleanMarkdown(rawDesc)
            if (title) items.push({ title, description: description || undefined })
        }

        if (items.length > 0) return items
    }

    return items
}

function parseNumberedMarkdownCards(text: string) {
    const normalized = normalizeNewlines(text)

    const patterns = [
        /^\s*\*\*\s*\d+[\.\)\）]\s*(.+?)\s*\*\*\s*$/gm,
        /^\s*\d+[\.\)\）]\s*\*\*(.+?)\*\*\s*$/gm,
        /^\s*\*\*(.+?)\*\*\s*$/gm,
        /^\s*#{2,4}\s+(.+?)\s*$/gm,
        /^\s*-\s+\*\*(.+?)\*\*\s*$/gm,
    ]

    for (const pattern of patterns) {
        const matches = Array.from(normalized.matchAll(pattern))
        if (matches.length > 1 || (matches.length === 1 && pattern !== patterns[4])) {
            const items: ParsedCardDraftItem[] = []
            for (let i = 0; i < matches.length; i++) {
                const title = (matches[i][1] || '').trim()
                const cleanTitle = title.replace(/^\d+[\.\)\）]?\s*/, '').trim()
                const startIndex = (matches[i].index ?? 0) + matches[i][0].length
                const endIndex = i + 1 < matches.length ? matches[i + 1].index ?? normalized.length : normalized.length
                const body = normalized.slice(startIndex, endIndex).trim()
                const description = cleanMarkdown(body)
                if (cleanTitle) items.push({ title: cleanTitle, description: description || undefined })
            }
            if (items.length > 0) return items
        }
    }

    const lines = normalized.split('\n')
    const items: ParsedCardDraftItem[] = []
    let currentTitle = ''
    let currentDescription = ''

    for (const line of lines) {
        const trimmed = line.trim()
        const isTitle = /^\*\*[^*]+\*\*$/.test(trimmed) || /^\d+[\.\)\）]\s/.test(trimmed)

        if (isTitle) {
            if (currentTitle) items.push({ title: currentTitle, description: currentDescription.trim() || undefined })
            currentTitle = trimmed.replace(/\*\*/g, '').replace(/^\d+[\.\)\）]\s*/, '').trim()
            currentDescription = ''
        } else if (currentTitle && trimmed) {
            currentDescription += trimmed + '\n'
        }
    }

    if (currentTitle) items.push({ title: currentTitle, description: currentDescription.trim() || undefined })
    return items
}

function parseKeyValueCards(text: string) {
    const lines = normalizeNewlines(text).split('\n')
    const items: ParsedCardDraftItem[] = []

    const titleRe = /^\s*(?:\d+[\.\)\）]\s*)?(?:[-*•]\s*)?(?:\*\*)?(?:标题|title)\s*[:：]\s*(.+?)(?:\*\*)?\s*$/i
    const descRe = /^\s*(?:[-*•]\s*)?(?:\*\*)?(?:描述|description)\s*[:：]\s*(.+?)(?:\*\*)?\s*$/i

    let currentTitle = ''
    let descLines: string[] = []

    const flush = () => {
        if (!currentTitle) return
        const description = cleanMarkdown(descLines.join('\n'))
        items.push({ title: cleanMarkdown(currentTitle), description: description || undefined })
        currentTitle = ''
        descLines = []
    }

    for (const line of lines) {
        const t = line.trim()
        if (!t) continue

        const titleMatch = line.match(titleRe)
        if (titleMatch) {
            flush()
            currentTitle = titleMatch[1] ?? ''
            continue
        }

        const descMatch = line.match(descRe)
        if (descMatch && currentTitle) {
            descLines.push(descMatch[1] ?? '')
            continue
        }

        if (currentTitle) descLines.push(line)
    }

    flush()
    return items
}
