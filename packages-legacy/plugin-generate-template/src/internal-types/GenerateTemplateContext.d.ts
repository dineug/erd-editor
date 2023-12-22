import { Observable } from 'rxjs';
import { ERDEditorContext } from 'vuerd';

import { DataTypeStore } from '@/stores/dataType.store';
import { TemplateStore } from '@/stores/template.store';
import { UIStore } from '@/stores/ui.store';

import { GlobalEventObservable } from './event.helper';

export interface GenerateTemplateContext {
  api: ERDEditorContext;
  host: ShadowRoot;
  globalEvent: GlobalEventObservable;
  stores: {
    ui: UIStore;
    template: TemplateStore;
    dataType: DataTypeStore;
  };
  keydown$: Observable<KeyboardEvent>;
}
