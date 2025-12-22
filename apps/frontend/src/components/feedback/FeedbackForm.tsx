/**
 * Feedback Form Component
 */
export interface FeedbackFormProps {
  onSubmit?: (feedback: string) => void
  className?: string
}

export function FeedbackForm({ onSubmit: _onSubmit, className }: FeedbackFormProps) {
  return (
    <div className={className}>
      <p className="text-muted-foreground">Feedback form coming soon.</p>
    </div>
  )
}
