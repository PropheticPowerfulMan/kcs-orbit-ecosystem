import { useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import { translateToFrench } from "../i18n/translations";

const textOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();
const attributes = ["placeholder", "title", "aria-label"] as const;

const withWhitespace = (value: string, translated: string) => `${value.match(/^\s*/)?.[0] ?? ""}${translated}${value.match(/\s*$/)?.[0] ?? ""}`;

const translateText = (node: Text, french: boolean) => {
  const current = node.nodeValue ?? "";
  if (!node.parentElement || node.parentElement.closest("script,style,textarea,[data-no-translate]")) return;
  let original = textOriginals.get(node);
  if (french && !original) {
    const translated = translateToFrench(current.trim());
    if (!current.trim() || translated === current.trim()) return;
    original = current;
    textOriginals.set(node, original);
  }
  if (!original) return;
  let target = french ? withWhitespace(original, translateToFrench(original.trim())) : original;
  if (french && current !== original && current !== target) {
    const translated = translateToFrench(current.trim());
    if (translated === current.trim()) {
      textOriginals.delete(node);
      return;
    }
    original = current;
    textOriginals.set(node, original);
    target = withWhitespace(original, translated);
  }
  if (current !== target) node.nodeValue = target;
};

const translateAttributes = (element: Element, french: boolean) => {
  let originals = attributeOriginals.get(element);
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    let original = originals?.get(attribute);
    if (french && !original) {
      const translated = translateToFrench(current);
      if (translated === current) continue;
      originals ??= new Map<string, string>();
      originals.set(attribute, current);
      attributeOriginals.set(element, originals);
      original = current;
    }
    if (!original) continue;
    const target = french ? translateToFrench(original) : original;
    if (current !== target) element.setAttribute(attribute, target);
  }
};

const translateTree = (root: Node, french: boolean) => {
  if (root.nodeType === Node.TEXT_NODE) translateText(root as Text, french);
  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root as Element, french);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateText(node as Text, french);
    else translateAttributes(node as Element, french);
  }
};

export const AppTranslator = () => {
  const { language } = useApp();
  useEffect(() => {
    const root = document.getElementById("root");
    const french = language === "fr";
    document.documentElement.lang = language;
    document.title = french ? "Planificateur de leçons KCS" : "KCS Lesson Planner";
    const nativeConfirm = window.confirm.bind(window);
    const nativePrompt = window.prompt.bind(window);
    window.confirm = (message?: string) => nativeConfirm(french ? translateToFrench(message ?? "") : message);
    window.prompt = (message?: string, defaultValue?: string) => nativePrompt(french ? translateToFrench(message ?? "") : message, defaultValue);
    if (!root) return () => { window.confirm = nativeConfirm; window.prompt = nativePrompt; };
    translateTree(root, french);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateText(mutation.target as Text, french);
        else {
          mutation.addedNodes.forEach(node => translateTree(node, french));
          if (mutation.type === "attributes") translateAttributes(mutation.target as Element, french);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...attributes] });
    return () => {
      observer.disconnect();
      window.confirm = nativeConfirm;
      window.prompt = nativePrompt;
    };
  }, [language]);
  return null;
};
