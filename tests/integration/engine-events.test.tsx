import { renderHook } from '@testing-library/react-native';

import AudioEngine, { type MidiEvent } from '../../modules/audio-engine';
import { useEngineEvent } from '../../src/engine/events';

const native = jest.mocked(AudioEngine.addListener);
const noteOn: MidiEvent = { type: 'noteOn', channel: 0, data1: 60, data2: 100 };

/** Sends an event through the latest native subscription. */
const emit = (event: MidiEvent) => (native.mock.calls.at(-1)![1] as (e: MidiEvent) => void)(event);

test('subscribes once and always calls the latest listener, without resubscribing on every render', async () => {
  const first = jest.fn();
  const second = jest.fn();
  const { rerender, unmount } = await renderHook(
    ({ listener }: { listener: (e: MidiEvent) => void }) => useEngineEvent('onMidiEvent', listener),
    {
      initialProps: { listener: first },
    },
  );
  await rerender({ listener: second });

  expect(native).toHaveBeenCalledTimes(1);
  emit(noteOn);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith(noteOn);

  const subscription = native.mock.results[0]!.value as { remove: jest.Mock };
  await unmount();
  expect(subscription.remove).toHaveBeenCalledTimes(1);
});

test('listens only while enabled (MIDI learn waits for a note only when asked)', async () => {
  const listener = jest.fn();
  const { rerender } = await renderHook(
    ({ enabled }: { enabled: boolean }) => useEngineEvent('onMidiEvent', listener, enabled),
    {
      initialProps: { enabled: false },
    },
  );
  expect(native).not.toHaveBeenCalled();

  await rerender({ enabled: true });
  emit(noteOn);
  expect(listener).toHaveBeenCalledTimes(1);

  const subscription = native.mock.results[0]!.value as { remove: jest.Mock };
  await rerender({ enabled: false });
  expect(subscription.remove).toHaveBeenCalledTimes(1);
});
