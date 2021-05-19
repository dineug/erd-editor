import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { beforeMount } from '@vuerd/lit-observable';
import { getVuerdContext } from '@/components/ERDEditorProvider';

export function useContext(ctx: Element) {
  const ref: { value: IERDEditorContext | null } = { value: null };

  beforeMount(() => (ref.value = getVuerdContext(ctx)));

  return ref as { value: IERDEditorContext };
}
