interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

export function AutoResizeTextarea({ value, onChange, className, ...props }: AutoResizeTextareaProps) {
  return (
    <div className="grid">
      <textarea
        value={value}
        onChange={onChange}
        className={`${className} col-start-1 row-start-1 resize-none overflow-hidden h-full`}
        rows={1}
        {...props}
      />
      {/* Invisible clone to force the height of the grid */}
      <div 
        className={`${className} col-start-1 row-start-1 invisible whitespace-pre-wrap break-words pointer-events-none`}
        aria-hidden="true"
      >
        {value + " "}
      </div>
    </div>
  );
}
