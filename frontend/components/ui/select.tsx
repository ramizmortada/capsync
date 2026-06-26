"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { ScrollArea } from "./scroll-area"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  items: Record<string, React.ReactNode>;
  disabled?: boolean;
}

const SelectContext = React.createContext<SelectContextType | null>(null)

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

function Select({
  value,
  onValueChange,
  open: openProp,
  onOpenChange,
  disabled,
  children,
}: SelectProps) {
  const [open, setOpen] = React.useState(false)

  const activeOpen = openProp !== undefined ? openProp : open
  const activeSetOpen = React.useCallback((nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen)
    } else {
      setOpen(nextOpen)
    }
  }, [onOpenChange])

  // Automatically close dropdown on scroll events outside of the select-content
  React.useEffect(() => {
    if (!activeOpen) return

    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement
      if (target && target.closest && target.closest('[data-slot="select-content"]')) {
        return
      }
      activeSetOpen(false)
    }

    window.addEventListener("scroll", handleScroll, true)
    return () => {
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [activeOpen, activeSetOpen])

  // Recursively extract all SelectItem values and children from the React children tree
  const items = React.useMemo(() => {
    const extracted: Record<string, React.ReactNode> = {}
    function traverse(node: React.ReactNode) {
      if (!node) return
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return
        const props = child.props as any
        if (props && typeof props === "object") {
          if ('value' in props) {
            extracted[props.value] = props.children
          }
          if ('children' in props && props.children) {
            traverse(props.children)
          }
        }
      })
    }
    traverse(children)
    return extracted
  }, [children])

  const contextValue = React.useMemo(() => ({
    value,
    onValueChange,
    open: activeOpen,
    setOpen: activeSetOpen,
    items,
    disabled
  }), [value, onValueChange, activeOpen, activeSetOpen, items, disabled])

  return (
    <SelectContext.Provider value={contextValue}>
      <Popover open={activeOpen} onOpenChange={activeSetOpen} modal={false}>
        {children}
      </Popover>
    </SelectContext.Provider>
  )
}

function SelectGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  placeholder,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span"> & {
  placeholder?: string;
}) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  const selectedContent = ctx.value !== undefined && ctx.value !== null ? ctx.items[ctx.value] : null

  return (
    <span 
      data-slot="select-value" 
      className={cn(ctx.value === undefined || ctx.value === null ? "text-muted-foreground" : "", className)}
      {...props}
    >
      {selectedContent !== undefined && selectedContent !== null ? selectedContent : placeholder}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  size?: "sm" | "default"
}) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  const isDisabled = props.disabled || ctx.disabled

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        disabled={isDisabled}
        data-slot="select-trigger"
        data-size={size}
        className={cn(
          "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </button>
    </PopoverTrigger>
  )
}

function SelectContent({
  className,
  children,
  align = "center",
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      data-slot="select-content"
      align={align}
      className={cn(
        "relative z-50 max-h-60 min-w-36 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1 w-[var(--radix-popover-trigger-width)]",
        className
      )}
      {...props}
    >
      <ScrollArea className="max-h-56 w-full">
        <div className="p-0.5">
          {children}
        </div>
      </ScrollArea>
    </PopoverContent>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground font-medium", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  value,
  children,
  disabled,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  value: string;
  disabled?: boolean;
}) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  const isSelected = ctx.value === value

  return (
    <div
      data-slot="select-item"
      data-state={isSelected ? "checked" : "unchecked"}
      data-disabled={disabled ? "true" : undefined}
      className={cn(
        "relative flex w-full items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
        disabled && "cursor-not-allowed opacity-50 pointer-events-none",
        className
      )}
      onClick={(e) => {
        if (disabled) return
        e.stopPropagation()
        ctx.onValueChange?.(value)
        ctx.setOpen(false)
      }}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        {isSelected && (
          <CheckIcon className="pointer-events-none size-4" />
        )}
      </span>
      <span>{children}</span>
    </div>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton() {
  return null
}

function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
