import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LibraryScreen from '../../src/app/library';
import { downloadBank, useLibrary } from '../../src/engine/library';
import { LIBRARY } from '../../src/model/library';
import { fakeFileSystem } from '../mocks/file-system';

jest.mock('expo-file-system', () => require('../mocks/file-system'));

const bank = LIBRARY[0]!;
const bankPath = `/documents/SoundBanks/${bank.id}.sf2`;
const partialPath = `${bankPath}.part`;

const lastDownload = () => fakeFileSystem.downloads.at(-1)!;

/** Taps « Télécharger » / « Réessayer »; the test then drives the download itself. */
const startDownload = (label = 'Télécharger') => fireEvent.press(screen.getAllByText(label)[0]!);

afterEach(async () => {
  // A download left running would block the next test's download of the same bank.
  await act(async () => fakeFileSystem.downloads.filter((d) => d.state === 'pending').forEach((d) => d.cancel()));
});

beforeEach(() => {
  fakeFileSystem.reset();
  useLibrary.setState(Object.fromEntries(LIBRARY.map((b) => [b.id, { state: 'absent' as const }])));
});

test('a bank downloads with its progress, then is installed under its final name', async () => {
  await render(<LibraryScreen />);
  await startDownload();
  expect(lastDownload().url).toBe(bank.url);

  await act(async () => lastDownload().progress(bank.size / 4, bank.size));
  expect(useLibrary.getState()[bank.id]).toEqual({ state: 'downloading', progress: 0.25 });
  expect(screen.getByText(/^25\s*%$/)).toBeOnTheScreen();

  await act(async () => lastDownload().finish(bank.size));
  expect(useLibrary.getState()[bank.id]).toEqual({ state: 'installed' });
  expect(fakeFileSystem.files.has(bankPath)).toBe(true);
  expect(fakeFileSystem.files.has(partialPath)).toBe(false);
  expect(screen.getByText('Supprimer')).toBeOnTheScreen();
});

test('an incomplete file is thrown away and the bank can be retried', async () => {
  await render(<LibraryScreen />);
  await startDownload();
  await act(async () => lastDownload().finish(bank.size - 1));

  expect(screen.getByText('Fichier incomplet, réessaie')).toBeOnTheScreen();
  expect(fakeFileSystem.files.size).toBe(0);
  await startDownload('Réessayer');
  expect(fakeFileSystem.downloads).toHaveLength(2);
});

test('a network failure shows its message and leaves no partial file', async () => {
  await render(<LibraryScreen />);
  await startDownload();
  await act(async () => lastDownload().fail('Connexion perdue'));
  expect(screen.getByText('Connexion perdue')).toBeOnTheScreen();
  expect(fakeFileSystem.files.has(partialPath)).toBe(false);
});

test('cancelling a download returns to the download button without an error', async () => {
  await render(<LibraryScreen />);
  await startDownload();
  // A second request while it downloads must not start another download.
  await act(async () => downloadBank(bank));
  expect(fakeFileSystem.downloads).toHaveLength(1);

  await fireEvent.press(screen.getByLabelText('Annuler'));
  await act(async () => {});
  expect(useLibrary.getState()[bank.id]).toEqual({ state: 'absent' });
  expect(screen.queryByText('Téléchargement interrompu')).toBeNull();
});

test('deleting an installed bank asks first, then removes its file', async () => {
  fakeFileSystem.files.set(bankPath, bank.size);
  useLibrary.setState({ [bank.id]: { state: 'installed' } });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<LibraryScreen />);

  await fireEvent.press(screen.getByText('Supprimer'));
  expect(fakeFileSystem.files.has(bankPath)).toBe(true);
  const buttons = alert.mock.calls[0]![2]!;
  await act(async () => buttons.find((b) => b.text === 'Supprimer')!.onPress!());

  expect(fakeFileSystem.files.has(bankPath)).toBe(false);
  expect(useLibrary.getState()[bank.id]).toEqual({ state: 'absent' });
  alert.mockRestore();
});
