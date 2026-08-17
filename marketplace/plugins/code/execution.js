import { transform } from "sucrase";

export function prepareBrowserSource(source, language) {
  const transforms = [];
  if (language === "typescript" || language === "tsx") transforms.push("typescript");
  if (language === "jsx" || language === "tsx") transforms.push("jsx");
  if (!transforms.length) return String(source || "");
  return transform(String(source || ""), { transforms, filePath: `main.${language}` }).code;
}