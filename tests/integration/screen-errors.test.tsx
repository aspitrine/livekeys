import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import fs from 'node:fs';
import path from 'node:path';

import { ScreenError } from '../../src/components/ScreenError';

const APP = path.join(__dirname, '../../src/app');
const routes = fs
  .readdirSync(APP, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.tsx'))
  .sort();

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

test.each(routes)('%s has its own error screen, so a crash stays inside it', (file) => {
  const route = require(path.join(APP, file));
  expect(route.ErrorBoundary).toBe(ScreenError);
});

test('a crashed screen can be retried or closed, and says the sound goes on', async () => {
  const retry = jest.fn(async () => {});
  await render(<ScreenError error={new Error('layer missing')} retry={retry} />);

  expect(screen.getByText('layer missing')).toBeOnTheScreen();
  expect(screen.getByText(/Le son continue/)).toBeOnTheScreen();
  expect(console.error).toHaveBeenCalledWith('[screen]', expect.any(Error));

  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.press(screen.getByText('Réessayer'));
  expect(retry).toHaveBeenCalledTimes(1);
  await user.press(screen.getByText('Fermer'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('the root error screen offers no close button when there is nowhere to go back', async () => {
  jest.mocked(router.canGoBack).mockImplementation(() => {
    throw new Error('navigator not ready');
  });
  await render(<ScreenError error={new Error('boot')} retry={async () => {}} />);
  expect(screen.getByText('Réessayer')).toBeOnTheScreen();
  expect(screen.queryByText('Fermer')).toBeNull();
});
