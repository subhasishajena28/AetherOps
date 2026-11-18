import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    const prev = document.activeElement as HTMLElement;
    d?.showModal();
    return () => {
      d?.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <span className="eyebrow">AETHEROPS WORKSPACE</span>
        <button
          aria-label="Close dialog"
          className="icon-btn"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
