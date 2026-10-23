import React, {createContext, useContext, useEffect} from 'react';
import {Modal} from 'react-native';

// Embedded tools share the workspace's single native window and persistent tabs.
export const ProviderPanelBackContext = createContext<((handler: () => void) => () => void) | null>(null);
export function ProviderPanel({embedded = false, onClose, children}: {embedded?: boolean; onClose: () => void; children: React.ReactNode}) {
  const registerBack = useContext(ProviderPanelBackContext);
  useEffect(() => embedded ? registerBack?.(onClose) : undefined, [embedded, registerBack, onClose]);
  return embedded ? <>{children}</> : <Modal animationType="slide" onRequestClose={onClose}>{children}</Modal>;
}
