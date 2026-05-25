import { Modal } from "@/components/Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  label?: string;
}

export function ConfirmModal({ open, onClose, onConfirm, label = "este item" }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Excluir">
      <p className="text-sm text-white/70 mb-5">
        Tem certeza que deseja excluir {label}? Esta ação não pode ser desfeita.
      </p>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button
          className="btn border-nexus-error/40 text-nexus-error hover:bg-nexus-error/20"
          onClick={() => { onConfirm(); onClose(); }}
        >
          Excluir
        </button>
      </div>
    </Modal>
  );
}
