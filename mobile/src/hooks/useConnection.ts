import { useContext } from 'react';
import { ConnectionContext } from '../contexts/ConnectionContext';

export function useConnection() {
  return useContext(ConnectionContext);
}