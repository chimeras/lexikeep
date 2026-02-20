type InlineSpinnerProps = {
  size?: number;
  className?: string;
};

export default function InlineSpinner({ size = 16, className = '' }: InlineSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
