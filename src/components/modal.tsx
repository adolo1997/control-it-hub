"use client";

import { X } from "lucide-react";
import { type ReactNode, useRef } from "react";

type ModalProps = {
  title: string;
  triggerLabel: string;
  triggerClassName?: string;
  children: ReactNode;
};

export function Modal({ title, triggerLabel, triggerClassName = "button", children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button className={triggerClassName} onClick={() => dialogRef.current?.showModal()} type="button">
        {triggerLabel}
      </button>
      <dialog
        className="modal"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialogRef.current?.close();
          }
        }}
        ref={dialogRef}
      >
        <div className="modal-panel">
          <div className="modal-header">
            <h2>{title}</h2>
            <button
              aria-label="Cerrar"
              className="icon-button"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
