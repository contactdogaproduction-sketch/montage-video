import { create } from 'zustand';

interface Notice {
  id: number;
  message: string;
}

interface NoticeState {
  notices: Notice[];
  dismiss: (id: number) => void;
}

const DISPLAY_MS = 5000;
let nextId = 1;

export const useNoticeStore = create<NoticeState>()((set) => ({
  notices: [],
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));

/** Affiche un message temporaire à l'utilisateur. */
export function notify(message: string): void {
  const id = nextId++;
  useNoticeStore.setState((s) => ({ notices: [...s.notices, { id, message }] }));
  window.setTimeout(() => useNoticeStore.getState().dismiss(id), DISPLAY_MS);
}
