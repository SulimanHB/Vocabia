import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

afterEach(() => { delete document.documentElement.dataset.theme; localStorage.clear(); });

it('cambia entre claro y oscuro, lo guarda y lo anuncia como interruptor', async () => {
  const user = userEvent.setup();
  render(<ThemeToggle label="Modo oscuro" />);
  const toggle = screen.getByRole('switch', { name: 'Modo oscuro' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('vocabia.theme')).toBe('dark');
  await user.click(toggle);
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('vocabia.theme')).toBe('light');
});

it('respeta el tema guardado al cargar', () => {
  document.documentElement.dataset.theme = 'dark';
  render(<ThemeToggle label="Modo oscuro" />);
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
});
