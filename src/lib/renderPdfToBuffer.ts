import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

/**
 * Custom PDF root components are valid at runtime but TS types expect
 * ReactElement<DocumentProps>; this bridges that mismatch.
 */
export function renderPdfToBuffer(node: ReactElement) {
  return renderToBuffer(node as ReactElement<DocumentProps>);
}
