// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import DriverModal from './components/DriverModal';

describe('DriverModal - Senha Temporária', () => {
  afterEach(() => {
    cleanup();
  });
  it('exibe aviso de senha temporaria uma vez com botao Copiar quando onSave devolve temporary_password', async () => {
    const handleSave = vi.fn().mockResolvedValue({
      id: 101,
      name: 'Novo Motorista',
      temporary_password: 'test_temp_pass_xyz',
    });
    const handleClose = vi.fn();

    render(
      <DriverModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        driver={null}
        trucks={[]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Novo Motorista' },
    });
    fireEvent.change(screen.getByLabelText(/E-mail \(Login\)/i), {
      target: { value: 'novo@empresa.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Motorista/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText(/Senha temporária do app: test_temp_pass_xyz\. Copie agora; ela não será exibida de novo\./i)
    ).not.toBeNull();

    const copyBtn = screen.getByRole('button', { name: /Copiar/i });
    expect(copyBtn).not.toBeNull();

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test_temp_pass_xyz');
    expect(screen.getByText('Copiado!')).not.toBeNull();

    const closeBtn = screen.getByRole('button', { name: /Concluir e Fechar/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('NAO exibe aviso quando gestor digita senha e onSave nao devolve temporary_password', async () => {
    const handleSave = vi.fn().mockResolvedValue({
      id: 102,
      name: 'Motorista Com Senha',
    });
    const handleClose = vi.fn();

    render(
      <DriverModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        driver={null}
        trucks={[]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Motorista Com Senha' },
    });
    fireEvent.change(screen.getByLabelText(/E-mail \(Login\)/i), {
      target: { value: 'gestor_definiu@empresa.com' },
    });
    fireEvent.change(screen.getByLabelText(/Senha de Acesso/i), {
      target: { value: 'MinhaSenhaForte123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Motorista/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'MinhaSenhaForte123' })
      );
    });

    expect(screen.queryByText(/Senha temporária do app:/i)).toBeNull();
  });
});
