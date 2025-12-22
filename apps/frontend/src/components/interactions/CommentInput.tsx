/**
 * Comment Input Component
 */
export interface CommentInputProps {
  onSubmit?: (comment: string) => void
  placeholder?: string
  className?: string
}

export function CommentInput({
  onSubmit: _onSubmit,
  placeholder = 'Write a comment...',
  className,
}: CommentInputProps) {
  return (
    <div className={className}>
      <textarea
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background p-2 text-sm"
      />
    </div>
  )
}
