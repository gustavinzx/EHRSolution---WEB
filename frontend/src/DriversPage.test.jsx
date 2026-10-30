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
      activateDriver: vi.fn()
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
      activateDriver: vi.fn()
    });
    render(<DriversPage />);
    expect(screen.getByText('XYZ-9876')).not.toBeNull();
  });
});
