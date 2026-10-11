import React from "react";
import Link from "next/link";
import clsx from "clsx";

/**
 * Shared CRM component system. Every CRM page (including event/ticket and
 * OpenUI-rendered surfaces) composes these primitives — no module-specific
 * button/badge/modal/wizard/table styles.
 *
 * Visual language: soft curves (rounded cards, pill buttons/badges, rounded
 * inputs), thin neutral borders, gentle shadows, and a single blue accent for
 * primary actions — matching the reference app UI.
 */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary:
      "border border-transparent bg-accent-600 text-white shadow-sm hover:bg-accent-700",
    secondary:
      "border border-border bg-surface text-ink-700 shadow-sm hover:border-ink-300 hover:bg-ink-50",
    danger:
      "border border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700",
    ghost:
      "border border-transparent bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;
  const describedById = `${id}-desc`;

  // Associate the label (and hint/error text) with the single form control so
  // screen readers announce them, without each page wiring htmlFor by hand.
  let control = children;
  if (React.isValidElement(children)) {
    const el = children as React.ReactElement<{
      id?: string;
      "aria-describedby"?: string;
    }>;
    const needsId = !el.props.id;
    const needsDesc = Boolean(hint || error) && !el.props["aria-describedby"];
    if (needsId || needsDesc) {
      control = React.cloneElement(el, {
        ...(needsId ? { id } : {}),
        ...(needsDesc ? { "aria-describedby": describedById } : {}),
      });
    }
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-[0.8rem] font-medium text-ink-700"
        >
          {label}
          {required ? " *" : ""}
        </label>
      )}
      {control}
      {hint && !error && (
        <p id={describedById} className="text-xs text-ink-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={describedById} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-field border border-border bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100 disabled:bg-ink-50";

export const TextField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextField({ className, ...props }, ref) {
  return <input ref={ref} className={clsx(inputClass, className)} {...props} />;
});

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputClass, className)} {...props} />;
}

interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled: boolean;
}

/**
 * Parse <option> children into plain data so Select can render its own styled
 * listbox instead of the browser's native (unstyled) dropdown popup. Supports
 * <optgroup> by flattening with a group label prefix.
 */
function collectOptions(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as {
        value?: string | number;
        disabled?: boolean;
        children?: React.ReactNode;
      };
      out.push({
        value: props.value === undefined ? "" : String(props.value),
        label: props.children,
        disabled: Boolean(props.disabled),
      });
      return;
    }
    if (child.type === "optgroup") {
      const props = child.props as { children?: React.ReactNode };
      out.push(...collectOptions(props.children));
    }
  });
  return out;
}

/**
 * Custom dropdown: a button styled like the other fields plus a rounded-card
 * listbox, so the open menu matches the CRM instead of the OS default. Keeps
 * the native <select> onChange contract (event.target.value) so call sites are
 * unchanged, and supports keyboard navigation.
 */
export function Select({
  className,
  children,
  value,
  onChange,
  disabled,
  name,
  id,
  "aria-describedby": ariaDescribedBy,
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options = React.useMemo(() => collectOptions(children), [children]);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const listId = React.useId();

  const currentValue = value === undefined ? "" : String(value);
  const selected =
    options.find((o) => o.value === currentValue) ?? options[0];

  const commit = React.useCallback(
    (next: string) => {
      onChange?.({
        target: { value: next, name },
      } as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
    },
    [onChange, name]
  );

  React.useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === currentValue);
    setActiveIndex(idx < 0 ? 0 : idx);
    const onDocPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open, options, currentValue]);

  const move = (delta: number) => {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        move(e.key === "ArrowDown" ? 1 : -1);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) {
        const opt = options[activeIndex];
        if (opt && !opt.disabled) commit(opt.value);
      } else {
        setOpen(true);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      {/* Hidden native control keeps form semantics (name) intact. */}
      <select
        name={name}
        value={currentValue}
        onChange={(e) => onChange?.(e)}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        {children}
      </select>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={clsx(
          inputClass,
          "flex items-center justify-between gap-2 pr-3 text-left disabled:cursor-not-allowed",
          open && "border-accent-500 ring-2 ring-accent-100"
        )}
      >
        <span className={clsx("truncate", !selected && "text-ink-300")}>
          {selected?.label ?? "Select…"}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={clsx(
            "h-4 w-4 shrink-0 text-ink-400 transition-transform",
            open && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface p-1 shadow-pop"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-400">No options</li>
          )}
          {options.map((opt, i) => {
            const isSelected = opt.value === currentValue;
            const isActive = i === activeIndex;
            return (
              <li
                key={`${opt.value}-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onMouseEnter={() => !opt.disabled && setActiveIndex(i)}
                onClick={() => !opt.disabled && commit(opt.value)}
                className={clsx(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-field px-3 py-2 text-sm transition-colors",
                  opt.disabled && "cursor-not-allowed opacity-40",
                  isSelected
                    ? "bg-accent-50 font-medium text-accent-700"
                    : isActive
                      ? "bg-ink-100 text-ink-900"
                      : "text-ink-700"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M5 10.5 8.5 14 15 6.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DateTimeField(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <TextField type="datetime-local" {...props} />;
}

export function CurrencyField({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <TextField
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      className={className}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-card border border-border bg-surface shadow-card",
        padded && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "border-ink-200 bg-ink-50 text-ink-600",
  success: "border-green-100 bg-green-50 text-green-700",
  warning: "border-amber-100 bg-amber-50 text-amber-700",
  danger: "border-red-100 bg-red-50 text-red-700",
  info: "border-accent-100 bg-accent-50 text-accent-700",
};

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className={clsx("rounded-xl border px-4 py-3 text-sm", toneClasses[tone])}
    >
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="py-8 text-sm text-ink-500">{label}</p>;
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="py-8">
      <p className="text-sm text-red-600">
        {message || "Something went wrong."}
      </p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Table({
  head,
  children,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-ink-50">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-ink-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={clsx(
        "px-4 py-3 text-left text-xs font-semibold text-ink-500",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={clsx("px-4 py-3 text-sm text-ink-800", className)}
    >
      {children}
    </td>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
  editor,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /**
   * Long-form editor variant: the dialog is constrained to the viewport with a
   * sticky header, a single scrollable body, and a sticky action footer. On
   * mobile it becomes a full-screen editor. Small dialogs leave this off.
   */
  editor?: boolean;
}) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const titleId = React.useId();
  onCloseRef.current = onClose;

  // Editor variant only: keep the focused control and any freshly rendered
  // validation alert inside the scrollable body, so tabbing or a failed submit
  // never leaves the user staring at an off-screen field.
  React.useEffect(() => {
    if (!open || !editor) return;
    const body = bodyRef.current;
    if (!body) return;

    const scrollIntoBody = (el: Element) => {
      const node = el as HTMLElement;
      const bodyRect = body.getBoundingClientRect();
      const elRect = node.getBoundingClientRect();
      if (elRect.top < bodyRect.top) {
        body.scrollTop -= bodyRect.top - elRect.top + 16;
      } else if (elRect.bottom > bodyRect.bottom) {
        body.scrollTop += elRect.bottom - bodyRect.bottom + 16;
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) scrollIntoBody(e.target);
    };
    const observer = new MutationObserver(() => {
      const alert = body.querySelector('[role="alert"]');
      if (alert) scrollIntoBody(alert);
    });
    observer.observe(body, { childList: true, subtree: true });
    body.addEventListener("focusin", onFocusIn);
    return () => {
      observer.disconnect();
      body.removeEventListener("focusin", onFocusIn);
    };
  }, [open, editor]);

  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog.
    const focusables = () =>
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
    const first = focusables()?.[0];
    (first ?? dialogRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusables();
      if (!nodes || nodes.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  // Do not re-run the focus trap when a parent recreates its onClose callback
  // during a controlled form update. Cleanup restores the previous focus, so
  // doing that on every keystroke steals focus from the active input.
  }, [open]);

  if (!open) return null;

  const header = (
    <div
      className={clsx(
        "flex items-start justify-between gap-4",
        editor && "shrink-0 border-b border-border px-6 py-4"
      )}
    >
      <div className={editor ? "min-w-0" : undefined}>
        <h2
          id={titleId}
          className="text-lg font-semibold tracking-tight text-ink-900"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="rounded-full p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        ✕
      </button>
    </div>
  );

  if (editor) {
    // Long-form editor: the dialog itself is constrained to the viewport and
    // never scrolls as a whole. Only the body scrolls; the header and the
    // action footer stay put. On small screens it becomes a full-screen editor.
    return (
      <div
        className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink-950/30 backdrop-blur-[2px] sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={clsx(
            "flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border-border bg-surface shadow-pop sm:h-auto sm:rounded-card sm:border",
            "sm:max-h-[calc(100dvh-32px)]",
            wide ? "sm:max-w-3xl" : "sm:max-w-2xl"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          <div
            ref={bodyRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5"
          >
            {children}
          </div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/30 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "w-full rounded-card border border-border bg-surface p-6 shadow-pop",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">{header}</div>
        <div className="space-y-4">{children}</div>
        {footer && (
          <div className="mt-6 flex justify-end gap-2 border-t border-ink-100 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function WizardSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-3">
      {steps.map((step, i) => {
        const state =
          i === current ? "current" : i < current ? "done" : "upcoming";
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                state === "current" && "bg-accent-600 text-white",
                state === "done" && "bg-accent-100 text-accent-700",
                state === "upcoming" && "bg-ink-100 text-ink-400"
              )}
            >
              {i + 1}
            </span>
            <span
              className={clsx(
                "text-sm font-medium",
                state === "upcoming" ? "text-ink-400" : "text-ink-700"
              )}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <span className="ml-2 h-px w-6 bg-ink-200" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-700">{body}</div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Layout & content primitives. New work composes these instead of rolling its
// own headers/toolbars/stat cards/chips.
// ---------------------------------------------------------------------------

export function SectionHeading({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold text-ink-800">{children}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}

type ChipTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const chipTones: Record<ChipTone, string> = {
  neutral: "border-border bg-ink-50 text-ink-600",
  success: "border-green-100 bg-green-50 text-green-700",
  warning: "border-amber-100 bg-amber-50 text-amber-700",
  danger: "border-red-100 bg-red-50 text-red-700",
  info: "border-accent-100 bg-accent-50 text-accent-700",
  accent: "border-accent-100 bg-accent-50 text-accent-700",
};

export function Chip({
  tone = "neutral",
  selected,
  onClick,
  children,
}: {
  tone?: ChipTone;
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        selected ? "border-accent-200 bg-accent-50 text-accent-700" : chipTones[tone],
        onClick && "hover:border-ink-300"
      )}
    >
      {children}
    </Comp>
  );
}

/** Anchor styled as a button (keeps routing/accessible anchors for navigation). */
export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const styles: Record<ButtonVariant, string> = {
    primary: "border-transparent bg-accent-600 text-white shadow-sm hover:bg-accent-700",
    secondary:
      "border-border bg-surface text-ink-700 shadow-sm hover:border-ink-300 hover:bg-ink-50",
    danger: "border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700",
    ghost: "border-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  };
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        styles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** Search/filter row above a table. */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-4 flex flex-wrap items-end gap-3", className)}>
      {children}
    </div>
  );
}

/** Right-aligned action row for forms/modals. */
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mt-6 flex justify-end gap-2 border-t border-border pt-4", className)}>
      {children}
    </div>
  );
}

/**
 * Collapsible optional subsection inside a step card. Uses native <details> so
 * it works without JS, stays keyboard-accessible, and keeps long forms (like
 * event when/where) from forcing a scroll through optional fields.
 */
export function OptionalSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-card border border-border bg-ink-50/50 open:bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink-700 marker:content-none">
        <span className="flex items-center gap-2">
          <span className="text-ink-400 transition-transform group-open:rotate-90">
            ▸
          </span>
          {title}
        </span>
        {hint && <span className="text-xs font-normal text-ink-400">{hint}</span>}
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">
        {children}
      </div>
    </details>
  );
}

/** Standard section page shell: title/subtitle/actions + content container. */
export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </>
  );
}
