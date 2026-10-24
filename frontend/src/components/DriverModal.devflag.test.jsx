// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import DriverModal from './DriverModal';

const DEV_LABEL = /Somente desenvolvimento/i;
const trucks = [{ id: 1, plate: 'ABC-1234', model: 'Volvo FH' }];

const renderModal = (onSave) => (
  <DriverModal isOpen={true} onClose={vi.fn()} onSave={onSave} driver={null} trucks={trucks} />
);

const fillAndSubmit = (container) => {
  fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Carlos Silva' } });
  fireEvent.submit(container.querySelector('form'));
};

describe('DriverModal - opção de desenvolvimento (auto_enroll_face)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('com DEV=true a caixa aparece e marcar envia auto_enroll_face: true', async () => {
    vi.stubEnv('DEV', true);
    const onSave = vi.fn().mockResolvedValue({});
    const { container } = render(renderModal(onSave));

    const label = screen.getByText(DEV_LABEL);
    expect(label).toBeTruthy();
    fireEvent.click(label);
    fillAndSubmit(container);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].auto_enroll_face).toBe(true);
  });

  it('com DEV=true sem marcar envia auto_enroll_face: false', async () => {
    vi.stubEnv('DEV', true);
    const onSave = vi.fn().mockResolvedValue({});
    const { container } = render(renderModal(onSave));
    fillAndSubmit(container);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].auto_enroll_face).toBe(false);
  });

  it('com DEV=false a caixa NÃO aparece e o payload leva auto_enroll_face: false', async () => {
    vi.stubEnv('DEV', false);
    const onSave = vi.fn().mockResolvedValue({});
    const { container } = render(renderModal(onSave));

    expect(screen.queryByText(DEV_LABEL)).toBeNull();
    fillAndSubmit(container);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].auto_enroll_face).toBe(false);
  });

  it('com DEV=false o payload leva false mesmo se o estado interno estiver true', async () => {
    vi.stubEnv('DEV', true);
    const onSave = vi.fn().mockResolvedValue({});
    const { container, rerender } = render(renderModal(onSave));

    // marca com DEV=true (estado interno vira true) e depois "vira produção"
    fireEvent.click(screen.getByText(DEV_LABEL));
    vi.stubEnv('DEV', false);
    rerender(renderModal(onSave));

    expect(screen.queryByText(DEV_LABEL)).toBeNull();
    fillAndSubmit(container);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].auto_enroll_face).toBe(false);
  });
});
