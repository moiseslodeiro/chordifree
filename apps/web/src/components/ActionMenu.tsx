import { useEffect, useId, useRef, useState } from 'react';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
}

export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const keyboardOpen = useRef(false);
  const triggerId = useId();
  const menuId = useId();

  const enabledItems = () => [
    ...(panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
      []),
  ];

  const focusItem = (index: number) => {
    const list = enabledItems();
    if (list.length === 0) return;
    const bounded = (index + list.length) % list.length;
    list[bounded]?.focus();
  };

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => trigger.current?.focus());
    }
  };

  useEffect(() => {
    if (!open) return;
    if (keyboardOpen.current) {
      keyboardOpen.current = false;
      window.requestAnimationFrame(() => focusItem(0));
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="action-menu" ref={root}>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          if (open) {
            close(false);
            return;
          }
          keyboardOpen.current = event.detail === 0;
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            close();
            return;
          }
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          keyboardOpen.current = true;
          setOpen(true);
          window.requestAnimationFrame(() => {
            const list = enabledItems();
            focusItem(event.key === 'ArrowUp' ? list.length - 1 : 0);
          });
        }}
      >
        {label}
        <span className="action-menu-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          ref={panel}
          id={menuId}
          className="action-menu-panel"
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={(event) => {
            const list = enabledItems();
            const current = list.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            } else if (event.key === 'Tab') {
              event.preventDefault();
              close();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusItem(current + 1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusItem(current - 1);
            } else if (event.key === 'Home') {
              event.preventDefault();
              focusItem(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              focusItem(list.length - 1);
            }
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="action-menu-item"
              disabled={item.disabled}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
