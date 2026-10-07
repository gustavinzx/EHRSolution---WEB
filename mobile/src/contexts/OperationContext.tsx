import React, { createContext, useState, ReactNode, useContext } from 'react';
import { FuelOperation, SyncItem } from '../types/operation';
import { operationRepository } from '../repositories/operationRepository';
import { syncQueue } from '../storage/syncQueue';
import { apiClient } from '../services/api/apiClient';
import { ConnectionContext } from './ConnectionContext';

interface OperationContextData {
  currentOperation: FuelOperation | null;
  pendingSyncCount: number;
  startNewOperation: (driverId: string, vehicleId: string) => void;
  updateOperation: (data: Partial<FuelOperation>) => Promise<void>;
  finishOperation: (fuelAfter: number) => Promise<void>;
  synchronizePending: () => Promise<void>;
}

export const OperationContext = createContext<OperationContextData>(
  {} as OperationContextData
);

export const OperationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentOperation, setCurrentOperation] = useState<FuelOperation | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const { isOnline } = useContext(ConnectionContext);

  const startNewOperation = (driverId: string, vehicleId: string) => {
    const newOp: FuelOperation = {
      id: `op_${Date.now()}`,
      driverId,
      vehicleId,
      startedAt: new Date().toISOString(),
      connectionMode: isOnline ? 'ONLINE' : 'BLE',
      status: 'STARTED',
    };
    setCurrentOperation(newOp);
  };

  const updateOperation = async (data: Partial<FuelOperation>) => {
    if (!currentOperation) return;
    const updated = { ...currentOperation, ...data };
    setCurrentOperation(updated);
    await operationRepository.saveLocal(updated);
  };

  const finishOperation = async (fuelAfter: number) => {
    if (!currentOperation) return;

    const completedOp: FuelOperation = {
      ...currentOperation,
      fuelLevelAfter: fuelAfter,
      finishedAt: new Date().toISOString(),
      status: isOnline ? 'COMPLETED' : 'PENDING_SYNC',
    };

    setCurrentOperation(completedOp);
    await operationRepository.saveLocal(completedOp);

    if (!isOnline) {
      await syncQueue.enqueue(completedOp);
      const queue = await syncQueue.getQueue();
      setPendingSyncCount(queue.length);
    } else {
      try {
        await apiClient.syncOperation(completedOp);
        const syncedOp = { ...completedOp, status: 'SYNCED' as const };
        setCurrentOperation(syncedOp);
        await operationRepository.saveLocal(syncedOp);
      } catch {
        await syncQueue.enqueue(completedOp);
        const queue = await syncQueue.getQueue();
        setPendingSyncCount(queue.length);
      }
    }
  };

  const synchronizePending = async () => {
    if (!isOnline) return;

    const queue = await syncQueue.getQueue();
    for (const item of queue) {
      if (item.status === 'PENDING') {
        try {
          await syncQueue.updateItemStatus(item.id, 'SYNCING');
          await apiClient.syncOperation(item.payload);
          await syncQueue.removeItem(item.id);
        } catch {
          await syncQueue.updateItemStatus(item.id, 'FAILED');
        }
      }
    }

    const updatedQueue = await syncQueue.getQueue();
    setPendingSyncCount(updatedQueue.length);
  };

  return (
    <OperationContext.Provider
      value={{
        currentOperation,
        pendingSyncCount,
        startNewOperation,
        updateOperation,
        finishOperation,
        synchronizePending,
      }}
    >
      {children}
    </OperationContext.Provider>
  );
};