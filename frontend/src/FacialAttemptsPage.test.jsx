
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FacialAttemptsPage from './pages/FacialAttemptsPage';
import api from './api/client';

vi.mock('./api/client');

describe('FacialAttemptsPage', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({
      data: {
        data: [
          { id: 1, created_at: '2023-10-01T10:00:00Z', driver_name: 'João', truck_plate: 'ABC1234', success: true, score: 0.99, liveness_passed: true }
        ],
        meta: { total: 1 }
      }
    });
  });

  it('renders rows and calls api with filters', async () => {
    render(<FacialAttemptsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('João')).not.toBeNull();
      expect(screen.getAllByText('Sucesso').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/99%/).length).toBeGreaterThan(0);
    });

    // test filter
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'true' } });
    const filterBtn = screen.getByText('Filtrar');
    fireEvent.click(filterBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/facial-attempts?success=true');
    });
  });
});




