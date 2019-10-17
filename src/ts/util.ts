import log from './Logger'
import { v4 as uuid } from 'uuid'
import { SIZE_FONT } from './layout'

export {
  log,
  uuid
}

interface List {
  id: string
}

export function getData<T extends List> (list: T[], id: string): T | null {
  for (const v of list) {
    if (v.id === id) {
      return v
    }
  }
  return null
}

export function setData (target: any, data: any) {
  Object.keys(data).forEach((key) => {
    if (data[key] === null || data[key] === undefined) {
      target[key] = data[key]
    } else if (Array.isArray(data[key])) {
      target[key] = []
      data[key].forEach((value: any) => {
        const v = {}
        setData(v, value)
        target[key].push(v)
      })
    } else if (typeof data[key] === 'object') {
      target[key] = {}
      setData(target[key], data[key])
    } else {
      target[key] = data[key]
    }
  })
}

export function getDataIndex<T extends List> (list: T[], id: string): number | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      return i
    }
  }
  return null
}

export function isData<T extends List> (list: T[], id: string): boolean {
  for (const v of list) {
    if (v.id === id) {
      return false
    }
  }
  return true
}

// setup text width
let spanText: HTMLElement | null = null

export function addSpanText () {
  spanText = document.getElementById('span-text-width-erd')
  if (!spanText) {
    spanText = document.createElement('span')
    document.body.appendChild(spanText)
  }
  spanText.setAttribute('id', 'span-text-width-erd')
  spanText.setAttribute('style', `
    visibility: hidden;
    position: fixed;
    top: -10000px;
    font-size: ${SIZE_FONT + 2}px;
    font-family: 'Noto Sans', sans-serif;
  `)
}

// remove text width
export function removeSpanText () {
  if (spanText) {
    spanText.remove()
  }
}

/**
 * text width
 * @param text
 */
const TEXT_PADDING = 2

export function getTextWidth (text: string): number {
  let result = 0
  if (spanText) {
    spanText.innerHTML = text
    result = spanText.offsetWidth + TEXT_PADDING
  }
  return result
}

interface Name {
  id: string
  name: string
}

export function autoName<T extends Name> (list: T[], id: string, name: string, num: number = 1): string {
  let result = true
  for (const value of list) {
    if (name === value.name && value.id !== id && name !== '') {
      result = false
      break
    }
  }
  if (result) {
    return name
  }
  return autoName(list, id, name.replace(/[0-9]/g, '') + num, num + 1)
}

export function findParentLiByElement (el: HTMLElement | null): HTMLElement | null {
  if (el === null) {
    return null
  } else if (el.localName === 'li') {
    return el
  }
  return findParentLiByElement(el.parentElement)
}

export function markToHTML (className: string, target: string, key: string): string {
  const keyArray = key.split('')
  const strArray = target.split('')
  for (let i = 0; i < keyArray.length - 1; i++) {
    if (keyEquals(keyArray, i + 1)) {
      keyArray.splice(i, 1)
      i--
    }
  }
  const buf: string[] = []
  strArray.forEach((value) => {
    const html = keyHtml(keyArray, value, className)
    if (html) {
      buf.push(html)
    } else {
      buf.push(value)
    }
  })
  return buf.join('')
}

function keyEquals (keyArray: string[], start: number): boolean {
  let result = false
  for (let i = start + 1; i < keyArray.length; i++) {
    if (keyArray[start].toLowerCase() === keyArray[i].toLowerCase() || keyArray[start] === ' ') {
      result = true
      break
    }
  }
  return result
}

function keyHtml (keyArray: string[], target: string, className: string): string | null {
  let result: string | null = null
  for (const key of keyArray) {
    if (target.toLowerCase() === key.toLowerCase()) {
      result = '<span class="' + className + '">' + target + '</span>'
      break
    }
  }
  return result
}
