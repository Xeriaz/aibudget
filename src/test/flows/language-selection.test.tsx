import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../../App';
import { initializeDatabase } from '../../db/db';
import i18n from '../../i18n';

describe('Language Selection (English default vs Lithuanian)', () => {
  beforeEach(async () => {
    await initializeDatabase();
    localStorage.clear();
    await i18n.changeLanguage('en');
  });

  it('renders English by default and allows switching to Lithuanian and back', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for the app to initialize
    await screen.findByText('Net Cash Flow');

    // Verify default English navigation tabs
    expect(screen.getByRole('button', { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ledger$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^bills$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^log$/i })).toBeInTheDocument();

    // Navigate to Settings
    await user.click(screen.getByRole('button', { name: /^settings$/i }));
    expect(await screen.findByText(/lifestyle plan & settings/i)).toBeInTheDocument();

    // Verify Language selection section exists with English selected
    expect(screen.getByText(/language \/ kalba/i)).toBeInTheDocument();
    const ltButton = screen.getByRole('button', { name: /lietuvių/i });
    expect(ltButton).toBeInTheDocument();

    // Switch to Lithuanian
    await user.click(ltButton);

    // Verify localStorage persistence
    await waitFor(() => {
      expect(localStorage.getItem('aibudget_lang')).toBe('lt');
    });

    // Verify UI dynamically updated to Lithuanian
    expect(await screen.findByText(/gyvenimo būdo planas ir nustatymai/i)).toBeInTheDocument();
    expect(screen.getByText(/šviesi tema/i)).toBeInTheDocument();
    expect(screen.getByText(/tamsi tema/i)).toBeInTheDocument();

    // Verify bottom navigation updated to Lithuanian
    expect(screen.getByRole('button', { name: /^apžvalga$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^žurnalas$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sąskaitos$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^nustatymai$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^registruoti$/i })).toBeInTheDocument();

    // Verify category mapping shows Lithuanian "Išlaidos sau" for Self-Care category
    expect(screen.getByText('Išlaidos sau')).toBeInTheDocument();

    // Switch to Overview tab and verify Lithuanian titles
    await user.click(screen.getByRole('button', { name: /^apžvalga$/i }));
    expect(await screen.findByText('Grynasis pinigų srautas')).toBeInTheDocument();
    expect(screen.getByText('Išlaidos sau')).toBeInTheDocument();
    expect(screen.getByText('Būtinosios išlaidos')).toBeInTheDocument();

    // Switch to Ledger tab and verify Lithuanian diagram months
    await user.click(screen.getByRole('button', { name: /^žurnalas$/i }));
    expect(await screen.findByText('Saus')).toBeInTheDocument();
    expect(screen.getByText('Vas')).toBeInTheDocument();
    expect(screen.getByText('Kov')).toBeInTheDocument();
    expect(screen.getByText('Gruod')).toBeInTheDocument();

    // Return to Settings to switch back
    await user.click(screen.getByRole('button', { name: /^nustatymai$/i }));

    // Switch back to English
    const enButton = screen.getByRole('button', { name: /english/i });
    await user.click(enButton);

    await waitFor(() => {
      expect(localStorage.getItem('aibudget_lang')).toBe('en');
    });

    // Verify UI switched back to English
    expect(await screen.findByText(/lifestyle plan & settings/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ledger$/i })).toBeInTheDocument();
  });
});
