import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from './FormKit';

type DialogAction = {
  text: string;
  style?: 'cancel' | 'destructive';
  onPress?: () => void;
};
type DialogRequest = {
  title: string;
  message: string;
  actions?: [DialogAction, DialogAction?];
};
type ShowDialog = (title: string, message: string, actions?: DialogRequest['actions']) => void;

const DialogContext = React.createContext<ShowDialog | null>(null);

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [queue, setQueue] = React.useState<DialogRequest[]>([]);
  const dismissed = React.useRef<DialogRequest | null>(null);
  const showDialog = React.useCallback<ShowDialog>((title, message, actions) => {
    setQueue((current) => [...current, { title, message, actions }]);
  }, []);
  const dialog = queue[0];
  const cancel = dialog?.actions?.find((action) => action?.style === 'cancel');
  const confirm = dialog?.actions?.find((action) => action && action.style !== 'cancel');
  const finish = (action?: DialogAction) => {
    if (!dialog || dismissed.current === dialog) return;
    dismissed.current = dialog;
    setQueue((current) => current.slice(1));
    action?.onPress?.();
  };

  return (
    <DialogContext.Provider value={showDialog}>
      {children}
      {dialog && (
        <ConfirmDialog
          visible
          title={dialog.title}
          message={dialog.message}
          cancelLabel={cancel?.text}
          confirmLabel={confirm?.text ?? t('finance.done')}
          destructive={confirm?.style === 'destructive'}
          icon={confirm?.style === 'destructive' ? 'trash-outline' : 'information-circle-outline'}
          onCancel={() => finish(cancel)}
          onConfirm={() => finish(confirm)}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const showDialog = React.useContext(DialogContext);
  if (!showDialog) throw new Error('useAppDialog must be used inside AppDialogProvider');
  return showDialog;
}
