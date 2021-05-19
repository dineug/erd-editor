import { beforeMount } from '@vuerd/lit-observable';
import { Subject, fromEvent } from 'rxjs';
import { ignoreEnterProcess } from '@/core/operators/ignoreEnterProcess';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useEditorElement } from '@/extensions/panels/grid/hooks/editorElement.hook';

export function useKeydown(ctx: HTMLElement) {
  const editorRef = useEditorElement(ctx);
  const keydown$ = new Subject<KeyboardEvent>();
  const { unmountedGroup } = useUnmounted();

  beforeMount(() =>
    unmountedGroup.push(
      fromEvent<KeyboardEvent>(editorRef.value, 'keydown')
        .pipe(ignoreEnterProcess)
        .subscribe(event => keydown$.next(event))
    )
  );

  return { keydown$ };
}
