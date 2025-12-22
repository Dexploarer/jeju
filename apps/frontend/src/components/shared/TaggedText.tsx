/**
 * TaggedText Component
 *
 * Renders text with clickable @mentions, #hashtags, and $cashtags
 */

interface TaggedTextProps {
  text: string
  onTagClick?: (tag: string) => void
}

const TAG_PATTERN = /(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+|\$[a-zA-Z0-9_]+)/g

export function TaggedText({ text, onTagClick }: TaggedTextProps) {
  const parts = text.split(TAG_PATTERN)

  return (
    <>
      {parts.map((part, index) => {
        if (part.match(TAG_PATTERN)) {
          const isHandle = part.startsWith('@')
          const isHashtag = part.startsWith('#')
          const isCashtag = part.startsWith('$')

          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTagClick?.(part)
              }}
              className={`font-semibold hover:underline ${
                isHandle
                  ? 'text-blue-500'
                  : isHashtag
                    ? 'text-purple-500'
                    : isCashtag
                      ? 'text-green-500'
                      : ''
              }`}
            >
              {part}
            </button>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}
