import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SAVANEX_DYNAMIC_TRANSLATIONS, SAVANEX_TRANSLATIONS } from './runtimeTranslations';

const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const translatedValues = new WeakMap();
const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

function translateValue(value, language) {
  if (!value || !value.trim()) return value;
  let output = value;
  const pairs = [...SAVANEX_TRANSLATIONS].sort((left, right) => Math.max(right[0].length, right[1].length) - Math.max(left[0].length, left[1].length));
  for (const [fr, en] of pairs) {
    const source = language === 'fr' ? en : fr;
    const target = language === 'fr' ? fr : en;
    if (source && target && output.includes(source)) output = output.split(source).join(target);
  }
  for (const [frPattern, enReplacement, enPattern, frReplacement] of SAVANEX_DYNAMIC_TRANSLATIONS) {
    output = output.replace(language === 'fr' ? enPattern : frPattern, language === 'fr' ? frReplacement : enReplacement);
  }
  return output;
}

function processTextNode(node, language) {
  if (!node.parentElement || SKIPPED_TAGS.has(node.parentElement.tagName)) return;
  const previousTranslation = translatedValues.get(node);
  if (!originalText.has(node) || (previousTranslation !== undefined && node.nodeValue !== previousTranslation)) {
    originalText.set(node, node.nodeValue);
  }
  const translated = translateValue(originalText.get(node), language);
  translatedValues.set(node, translated);
  if (node.nodeValue !== translated) node.nodeValue = translated;
}

function processElement(element, language) {
  if (SKIPPED_TAGS.has(element.tagName)) return;
  let originals = originalAttributes.get(element);
  if (!originals) {
    originals = {};
    originalAttributes.set(element, originals);
  }
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;
    const current = element.getAttribute(attribute);
    const marker = `attr:${attribute}`;
    const previousTranslation = translatedValues.get(element)?.[marker];
    if (!(attribute in originals) || (previousTranslation !== undefined && current !== previousTranslation)) originals[attribute] = current;
    const translated = translateValue(originals[attribute], language);
    const elementTranslations = translatedValues.get(element) || {};
    elementTranslations[marker] = translated;
    translatedValues.set(element, elementTranslations);
    if (current !== translated) element.setAttribute(attribute, translated);
  }
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) processTextNode(child, language);
    else if (child.nodeType === Node.ELEMENT_NODE) processElement(child, language);
  }
}

export default function GlobalLanguageBridge() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en';

  useEffect(() => {
    document.documentElement.lang = language;
    const apply = () => processElement(document.body, language);
    apply();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') processTextNode(mutation.target, language);
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) processTextNode(node, language);
          else if (node.nodeType === Node.ELEMENT_NODE) processElement(node, language);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
