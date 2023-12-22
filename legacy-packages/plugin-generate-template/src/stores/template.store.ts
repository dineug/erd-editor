import { makeAutoObservable } from 'mobx';
import { Subject } from 'rxjs';

import { decodeBase64, orderByNameASC, uuid } from '@/core/helper';
import { Template } from '@/core/indexedDB';
import { templates as defaultTemplates } from '@/data/defaultTemplates';

export class TemplateStore {
  templates: Template[] = [];
  eventBus: Subject<any>;

  constructor(eventBus: Subject<any>) {
    this.eventBus = eventBus;
    makeAutoObservable(this);
  }

  setTemplates(templates: Template[]) {
    this.templates = templates;
    this.sort();
  }

  create(data: Pick<Template, 'name' | 'value'>) {
    this.templates.push({
      ...data,
      uuid: uuid(),
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });
    this.eventBus.next('TemplateStore.create');
  }

  update(data: Pick<Template, 'name' | 'value' | 'uuid'>) {
    const template = this.templates.find(
      template => template.uuid === data.uuid
    );
    if (!template) return;

    template.name = data.name;
    template.value = data.value;
    template.updatedAt = Date.now();
    this.eventBus.next('TemplateStore.update');
  }

  delete(uuid: string) {
    this.setTemplates(
      this.templates.filter(template => template.uuid !== uuid)
    );
    this.eventBus.next('TemplateStore.delete');
  }

  fetch(templates: Template[]) {
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
  }

  sort() {
    this.templates.sort(orderByNameASC);
  }
}
