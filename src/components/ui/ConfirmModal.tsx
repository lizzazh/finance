import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title = 'Подтверждение удаления',
  message = 'Вы уверены, что хотите удалить эту запись? Действие нельзя отменить.',
  confirmText = 'Удалить',
  cancelText = 'Отмена',
  isDanger = true,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal max-w-sm p-6 flex flex-col gap-4 text-center animate-in fade-in zoom-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 text-secondary hover:text-text p-1 rounded-lg"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
          {isDanger ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
        </div>

        <div>
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-xs text-secondary mt-1">{message}</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="btn-ghost flex-1 py-2 text-sm"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-xl text-white transition-all ${
              isDanger
                ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/20'
                : 'btn-primary'
            }`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
