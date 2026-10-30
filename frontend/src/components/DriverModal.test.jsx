// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import DriverModal from './DriverModal';

describe('DriverModal - Preservação de Formulário e Troca de Motorista', () => {
  afterEach(() => {
    cleanup();
  });

  it('a) digitar o nome, re-renderizar o modal com um NOVO array de trucks de mesmo conteúdo => o nome continua preenchido', () => {
    const initialTrucks = [{ id: 1, plate: 'ABC-1234', model: 'Volvo FH' }];
    const { rerender } = render(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={null}
        trucks={initialTrucks}
      />
    );

    const nameInput = screen.getByLabelText(/Nome Completo/i);
    fireEvent.change(nameInput, { target: { value: 'Carlos Silva' } });
    expect(nameInput.value).toBe('Carlos Silva');

    // Re-renderiza com um NOVO array contendo o mesmo conteúdo (nova referência em memória)
    rerender(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={null}
        trucks={[{ id: 1, plate: 'ABC-1234', model: 'Volvo FH' }]}
      />
    );

    // O nome deve continuar preenchido e NÃO ser resetado pelo efeito
    expect(screen.getByLabelText(/Nome Completo/i).value).toBe('Carlos Silva');
  });

  it('b) digitar, re-renderizar com trucks diferente (um caminhão a mais) => nome continua preenchido', () => {
    const initialTrucks = [{ id: 1, plate: 'ABC-1234', model: 'Volvo FH' }];
    const { rerender } = render(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={null}
        trucks={initialTrucks}
      />
    );

    const nameInput = screen.getByLabelText(/Nome Completo/i);
    fireEvent.change(nameInput, { target: { value: 'Mariana Costa' } });
    expect(nameInput.value).toBe('Mariana Costa');

    // Re-renderiza com trucks diferente (um caminhão a mais)
    rerender(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={null}
        trucks={[
          { id: 1, plate: 'ABC-1234', model: 'Volvo FH' },
          { id: 2, plate: 'XYZ-9876', model: 'Scania R450' },
        ]}
      />
    );

    expect(screen.getByLabelText(/Nome Completo/i).value).toBe('Mariana Costa');
  });

  it('c) fechar (isOpen=false) e reabrir => formulário volta em branco', () => {
    const trucks = [{ id: 1, plate: 'ABC-1234', model: 'Volvo FH' }];
    const { rerender } = render(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={null}
        trucks={trucks}
      />
    );

    const nameInput = screen.getByLabelText(/Nome Completo/i);
    fireEvent.change(nameInput, { target: { value: 'Motorista Temporário' } });
    expect(nameInput.value).toBe('Motorista Temporário');

    // Fecha o modal
    rerender(
      <DriverModal
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={null}
        trucks={trucks}
      />
    );

    // Reabre o modal
    rerender(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={null}
        trucks={trucks}
      />
    );

    expect(screen.getByLabelText(/Nome Completo/i).value).toBe('');
  });

  it('d) abrir para editar o motorista A e depois trocar o prop driver para o motorista B => formulário mostra os dados do B', () => {
    const driverA = {
      id: 10,
      name: 'Motorista Alpha',
      email: 'alpha@empresa.com',
      phone: '11999990001',
      assigned_trucks: [],
    };
    const driverB = {
      id: 20,
      name: 'Motorista Beta',
      email: 'beta@empresa.com',
      phone: '11999990002',
      assigned_trucks: [],
    };

    const { rerender } = render(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={driverA}
        trucks={[]}
      />
    );

    expect(screen.getByLabelText(/Nome Completo/i).value).toBe('Motorista Alpha');

    // Troca o prop driver para o motorista B
    rerender(
      <DriverModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        driver={driverB}
        trucks={[]}
      />
    );

    expect(screen.getByLabelText(/Nome Completo/i).value).toBe('Motorista Beta');
  });
});
