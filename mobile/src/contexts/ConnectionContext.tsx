import React, { createContext, useState, ReactNode } from 'react';

interface ConnectionContextData {
  isOnline: boolean;
  toggleConnection: () => void; // Permite simular queda de internet na auditoria/testes
}

export const ConnectionContext = createContext<ConnectionContextData>(
  {} as ConnectionContextData
);

export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);

  const toggleConnection = () => {
    setIsOnline((prev) => !prev);
  };

  return (
    <ConnectionContext.Provider value={{ isOnline, toggleConnection }}>
      {children}
    </ConnectionContext.Provider>
  );
};