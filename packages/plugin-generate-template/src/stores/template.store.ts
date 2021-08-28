import { makeAutoObservable } from 'mobx';

import {
  createTemplate,
  deleteByTemplateName,
  findTemplates,
  openIndexedDB,
  Template,
  updateByTemplateName,
} from '@/core/indexedDB';
import { findOne } from '@/core/indexedDB/operators/findOne';

export class TemplateStore {
  templates: Template[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  setTemplates(templates: Template[]) {
    this.templates = templates;
    this.sort();
  }

  add(data: Pick<Template, 'name' | 'value'>) {
    createTemplate(data).subscribe(key => {
      const subscription = openIndexedDB
        .pipe(findOne(key, 'template'))
        .subscribe(([template]) => {
          this.templates.push(template);
          subscription.unsubscribe();
        });
    });
  }

  update(data: Pick<Template, 'name' | 'value'>) {
    updateByTemplateName(data).subscribe(key => {
      const template = this.templates.find(template => template.name === key);
      if (!template) return;

      template.name = data.name;
      template.value = data.value;
    });
  }

  delete(name: string) {
    deleteByTemplateName(name).subscribe(old => {
      this.setTemplates(
        this.templates.filter(template => template.name !== old.name)
      );
    });
  }

  fetch() {
    findTemplates.subscribe(templates => {
      // TODO: create exampleTemplates
      // templates.length === 0

      this.setTemplates(templates);
    });
  }

  sort() {
    this.templates.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) {
        return -1;
      } else if (nameA > nameB) {
        return 1;
      }
      return 0;
    });
  }
}
