import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { PatchEditor } from '../../components/PatchEditor';

export { ScreenError as ErrorBoundary } from '../../components/ScreenError';

export default function PatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen
        options={{ headerRight: () => <Button label="Terminé" variant="ghost" onPress={() => router.back()} /> }}
      />
      <PatchEditor patchId={id} />
    </>
  );
}
