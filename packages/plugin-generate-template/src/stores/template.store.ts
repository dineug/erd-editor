import { makeAutoObservable, runInAction } from 'mobx';

import { decodeBase64, orderByNameASC } from '@/core/helper';
import {
  createTemplate,
  deleteByTemplateUUID,
  findTemplates,
  openIndexedDB,
  Template,
  updateByTemplateUUID,
} from '@/core/indexedDB';
import { findOne } from '@/core/indexedDB/operators/findOne';
import { templates as defaultTemplates } from '@/data/defaultTemplates';

export class TemplateStore {
  templates: Template[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  setTemplates(templates: Template[]) {
    this.templates = templates;
    this.sort();
  }

  create(data: Pick<Template, 'name' | 'value'>) {
    return new Promise(resolve => {
      createTemplate(data).subscribe(key => {
        const subscription = openIndexedDB
          .pipe(findOne(key, 'template'))
          .subscribe(([template]) => {
            runInAction(() => {
              this.templates.push(template);
              resolve(template);
            });
            subscription.unsubscribe();
          });
      });
    });
  }

  update(data: Pick<Template, 'name' | 'value' | 'uuid'>) {
    updateByTemplateUUID(data).subscribe(key => {
      const template = this.templates.find(template => template.uuid === key);
      if (!template) return;

      runInAction(() => {
        template.name = data.name;
        template.value = data.value;
      });
    });
  }

  delete(uuid: string) {
    deleteByTemplateUUID(uuid).subscribe(old => {
      this.setTemplates(
        this.templates.filter(template => template.uuid !== old.uuid)
      );
    });
  }

  fetch() {
    return new Promise(resolve => {
      findTemplates.subscribe({
        next: templates => {
          if (templates.length) {
            this.setTemplates(templates);
          } else {
            defaultTemplates.forEach(({ name, value }) =>
              this.create({
                name,
                value: decodeBase64(value).trim(),
              })
            );
          }
        },
        complete: () => resolve(null),
      });
    });
  }

  sort() {
    this.templates.sort(orderByNameASC);
  }
}
