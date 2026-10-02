import { fireEvent, render, screen } from '@testing-library/react-native';
import AudioEngine from '../../modules/audio-engine';
import { SplitKeyboard } from '../../src/components/SplitKeyboard';

async function touch(phase: string, ids = [1]) {
  await fireEvent(screen.getByTestId('split-keyboard'), phase, {
    nativeEvent: { changedTouches: ids.map((identifier) => ({ identifier, locationX: 180, locationY: 150 })) },
  });
}

async function keyboard() {
  const result = await render(<SplitKeyboard layers={[]} height={170} />);
  await fireEvent(screen.getByTestId('split-keyboard'), 'layout', {
    nativeEvent: { layout: { width: 880, height: 170 } },
  });
  return result;
}

test('leaving a keyboard screen releases a note whose finger never received touchEnd', async () => {
  const view = await keyboard();
  await touch('touchStart');
  expect(AudioEngine.noteOn).toHaveBeenCalledTimes(1);
  const note = jest.mocked(AudioEngine.noteOn).mock.calls[0][0];
  await view.unmount();
  expect(AudioEngine.noteOff).toHaveBeenCalledWith(note, 0);
});

test('a note started in play mode still releases after switching to note-picking mode', async () => {
  const view = await keyboard();
  await touch('touchStart');
  const note = jest.mocked(AudioEngine.noteOn).mock.calls[0][0];
  await view.rerender(<SplitKeyboard layers={[]} height={170} onPickNote={() => {}} />);
  await touch('touchEnd');
  expect(AudioEngine.noteOff).toHaveBeenCalledWith(note, 0);
});
