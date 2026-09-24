import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ElementType,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useRef,
} from "react";

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 shadow-sm",
  secondary: "bg-raised text-ink border border-control/60 hover:bg-surface shadow-sm",
  ghost: "text-ink hover:bg-surface",
  quiet: "text-accent hover:underline underline-offset-4 px-0!",
  danger: "bg-loss text-white hover:brightness-110 shadow-sm dark:text-bg",
};
const SIZE = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-base gap-2" } as const;

export const buttonClass = (variant: Variant = "secondary", size: keyof typeof SIZE = "md", extra?: string) =>
  cx(
    "inline-flex items-center justify-center rounded-control font-medium transition-[filter,background-color] select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none aria-disabled:opacity-45 aria-disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    extra,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZE;
  icon?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, className, children, type, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type ?? "button"} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

type PolyProps<E extends ElementType> = { as?: E; className?: string; children?: ReactNode } & Omit<
  ComponentPropsWithoutRef<E>,
  "as" | "className" | "children"
>;

export function Card<E extends ElementType = "section">({ as, className, children, ...rest }: PolyProps<E>) {
  const C = (as ?? "section") as ElementType;
  return (
    <C className={cx("rounded-card border border-hair bg-raised shadow-card", className)} {...rest}>
      {children}
    </C>
  );
}

export function CardHeader({
  title,
  eyebrow,
  actions,
  id,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-5 py-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-0.5 text-xs font-medium text-muted">{eyebrow}</p>}
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export const CardBody = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cx("px-5 py-4", className)}>{children}</div>
);

type Tone = "neutral" | "accent" | "ok" | "caution" | "loss";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-muted border-hair",
  accent: "bg-accent/10 text-accent border-accent/25",
  ok: "bg-ok/10 text-ok border-ok/25",
  caution: "bg-caution/10 text-caution border-caution/30",
  loss: "bg-loss/10 text-loss border-loss/30",
};
export function Badge({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  unit,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor: string;
  unit?: string;
  className?: string;
}) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;
  const describedBy = [error ? errorId : null, !error && hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const control = (() => {
    if (!isValidElement(children)) return children;
    const el = children as ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false"; id?: string }>;
    return cloneElement(el, {
      id: el.props.id ?? htmlFor,
      "aria-describedby": el.props["aria-describedby"] ?? describedBy,
      "aria-invalid": el.props["aria-invalid"] ?? (error ? true : undefined),
    });
  })();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {unit && <span className="ml-1 font-normal text-muted">({unit})</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (invalid?: boolean, extra?: string) =>
  cx(
    "h-10 w-full rounded-control border bg-bg px-3 text-sm text-ink placeholder:text-muted/70",
    "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-surface disabled:text-muted",
    invalid ? "border-loss" : "border-control/70",
    extra,
  );

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function TextInput(
  { invalid, className, ...rest },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={inputClass(invalid, className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={inputClass(invalid, cx("pr-8", className))} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <input id={rest.id ?? id} type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-accent" {...rest} />
      <label htmlFor={rest.id ?? id} className="cursor-pointer text-sm leading-snug">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-muted">{description}</span>}
      </label>
    </div>
  );
}

export function RadioCard({
  name,
  value,
  checked,
  onChange,
  disabled,
  title,
  meta,
  children,
  badge,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  disabled?: boolean;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  badge?: ReactNode;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cx(
        "flex cursor-pointer gap-3 rounded-card border p-4 transition-colors",
        checked ? "border-accent bg-accent/5 ring-1 ring-accent/40" : "border-hair bg-raised hover:border-control/60",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1 size-4 accent-accent"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {title}
          {badge}
        </span>
        {meta && <span className="mt-0.5 block text-sm text-muted">{meta}</span>}
        {children && <span className="mt-2 block text-sm">{children}</span>}
      </span>
    </label>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <svg className={cx("size-4 animate-spin text-current", className)} viewBox="0 0 24 24" role="img" aria-label={label}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cx("animate-pulse rounded-md bg-hair/70", className)} />
);

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      d.showModal();
      const focusable = d.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      focusable?.focus();
    }
    if (!open && d.open) {
      d.close();
      returnFocus.current?.focus?.();
      returnFocus.current = null;
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={labelledBy ?? id}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-card border border-hair bg-raised p-0 text-ink shadow-pop backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="border-b border-hair px-5 py-4">
        <h2 id={labelledBy ?? id} className="text-base font-semibold">
          {title}
        </h2>
      </div>
      <div className="px-5 py-4 text-sm">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-hair bg-surface px-5 py-3">{footer}</div>}
    </dialog>
  );
}

export function Stat({
  label,
  children,
  hint,
  tone,
  size = "lg",
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  size?: "md" | "lg";
}) {
  const color =
    tone === "loss"
      ? "text-loss"
      : tone === "ok"
        ? "text-ok"
        : tone === "caution"
          ? "text-caution"
          : tone === "accent"
            ? "text-accent"
            : "text-ink";
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx("num mt-1 font-semibold", size === "lg" ? "text-2xl" : "text-lg", color)}>{children}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  scr,
  title,
  lead,
  actions,
  eyebrow,
}: {
  scr: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          {eyebrow && <span className="font-medium text-muted">{eyebrow}</span>}
          <span className="num rounded bg-surface px-1.5 py-0.5 font-medium text-muted" data-scr={scr}>
            {scr}
          </span>
        </p>
        <h1 className="font-display text-2xl text-ink sm:text-[1.85rem] leading-snug">{title}</h1>
        {lead && <p className="mt-2 max-w-[42rem] text-base leading-relaxed text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="num rounded border border-hair bg-surface px-1.5 py-0.5 text-[0.7rem] text-muted">{children}</kbd>;
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  label: string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((it) => it.value === value);
    if (i < 0) return;
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const item = items[next];
    if (item) onChange(item.value);
  };
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-control border border-hair bg-surface p-0.5" onKeyDown={onKeyDown}>
      {items.map((it) => {
        const selected = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(it.value)}
            className={cx(
              "h-8 rounded-[0.4rem] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              selected ? "bg-raised text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
