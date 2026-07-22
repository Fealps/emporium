import { render, screen } from '@testing-library/react';
import App from './App';

test('renders auth register screen heading', () => {
  render(<App />);
  const headerElement = screen.getByText(/Adventurer's Emporium/i);
  expect(headerElement).toBeInTheDocument();
});
