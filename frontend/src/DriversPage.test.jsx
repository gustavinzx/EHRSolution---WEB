// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DriversPage from './pages/DriversPage';
import { useDrivers } from './hooks/useDrivers';
import { useFleet } from './hooks/useFleet';
import { useAuth } from './hooks/useAuth';

vi.mock('./hooks/useDrivers');
vi.mock('./hooks/useFleet');
vi.mock('./hooks/useAuth');

describe('DriversPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { role: 'manager', name: 'Gestor Teste' }
    });
    useFleet.mockReturnValue({
      trucks: []
    });
    useDrivers.mockReturnValue({
      drivers: [
        { id: 1, name: 'João Silva', is_active: true, face_enrolled: true },
        { id: 2, name: 'Maria Souza', is_active: true, face_enrolled: false }
      ],
      loading: false,
      error: null,
      fetchDrivers: vi.fn(),
      enrollFace: vi.fn().mockResolvedValue(true),
      removeFace: vi.fn(),
      deactivateDriver: vi.fn(),
      activateDriver: vi.fn(),
      resetDriverPassword: vi.fn()
    });
    // mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders enrollment badges', () => {
    render(<DriversPage />);
    expect(screen.getByText('Biometria Ativa')).not.toBeNull();
    expect(screen.getByText('Sem Biometria')).not.toBeNull();
  });

  it('opens modal and requires consent to enroll', async () => {
    const { enrollFace } = useDrivers();
    render(<DriversPage />);
    
    // click Cadastrar
    const btn = screen.getAllByText('Cadastrar')[0];
    fireEvent.click(btn);

    // modal opens
    expect(screen.getByText('Cadastrar Biometria Facial')).not.toBeNull();
    
    // confirm button is disabled initially
    const confirmBtn = screen.getByText('Confirmar Cadastro');
    expect(confirmBtn).toHaveProperty('disabled', true);

    // click checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(confirmBtn).not.toHaveProperty('disabled', true);

    // submit
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(enrollFace).toHaveBeenCalledWith(2, expect.objectContaining({ consent: true }));
    });
  });

  it('renders assigned truck plates', () => {
    useDrivers.mockReturnValue({
      drivers: [
        { id: 1, name: 'João Silva', is_active: true, face_enrolled: true, assigned_trucks: [{id:100, plate:'XYZ-9876', model:'Volvo'}] }
      ],
      loading: false,
      error: null,
      fetchDrivers: vi.fn(),
      enrollFace: vi.fn(),
      removeFace: vi.fn(),
      deactivateDriver: vi.fn(),
      activateDriver: vi.fn(),
      resetDriverPassword: vi.fn()
    });
    render(<DriversPage />);
    expect(screen.getByText('XYZ-9876')).not.toBeNull();
  });

  it('redefinir senha abre modal com aviso unico, copiar funciona e fechar limpa o estado', async () => {
    const resetDriverPassword = vi.fn().mockResolvedValue({
      id: 1,
      name: 'João Silva',
      temporaryPassword: 'TempPassNoAmbiguous789',
    });
    useDrivers.mockReturnValue({
      drivers: [
        { id: 1, name: 'João Silva', is_active: true, face_enrolled: true },
      ],
      loading: false,
      error: null,
      fetchDrivers: vi.fn(),
      enrollFace: vi.fn(),
      removeFace: vi.fn(),
      deactivateDriver: vi.fn(),
      activateDriver: vi.fn(),
      resetDriverPassword,
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<DriversPage />);

    const resetBtn = screen.getByRole('button', { name: /Redefinir senha/i });
    expect(resetBtn).not.toBeNull();

    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(resetDriverPassword).toHaveBeenCalledWith(1);
    });

    expect(screen.getByText('Esta senha aparece só agora. Anote ou copie antes de fechar.')).not.toBeNull();
    expect(screen.getByText('TempPassNoAmbiguous789')).not.toBeNull();

    const copyBtn = screen.getByRole('button', { name: /Copiar/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TempPassNoAmbiguous789');
    expect(screen.getByText('Copiado!')).not.toBeNull();

    const closeBtn = screen.getByRole('button', { name: /Fechar/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('TempPassNoAmbiguous789')).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain('TempPassNoAmbiguous789');
  });

  it('auditor nao ve o botao Redefinir senha', () => {
    useAuth.mockReturnValue({
      user: { role: 'auditor', name: 'Auditor Teste' },
    });
    render(<DriversPage />);
    expect(screen.queryByRole('button', { name: /Redefinir senha/i })).toBeNull();
  });
});
