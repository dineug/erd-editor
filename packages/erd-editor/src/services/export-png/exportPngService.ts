import {
  renderDocumentPng,
  type RenderPngRequest,
  type RenderPngResult,
} from './renderPng';
import { renderDocumentSvg, type RenderSvgRequest } from './renderSvg';
import {
  createOffscreenToWidth,
  measureFontProbe,
  sameFontProbe,
  type ToWidth,
} from './textWidth';

/**
 * A png request as it crosses a realm boundary. The measurement itself cannot
 * cross, so what travels is the widths the asking realm read for the probe
 * strings and the answering realm has to reproduce them.
 */
export type ExportPngRequest = RenderPngRequest & {
  fontProbe: number[];
};

/** An svg request as it crosses a realm boundary, gated by the same probe. */
export type ExportSvgRequest = RenderSvgRequest & {
  fontProbe: number[];
};

/**
 * Draws a document off the thread that asked for it. Text is measured here
 * rather than sent, because a table's reserved widths were laid out by a
 * measurement, and a picture drawn by a different one does not fit them.
 */
export class ExportPngService {
  /**
   * What this realm lays the probe strings out to. Answering it at all proves
   * the module graph evaluated here, which is the failure a shared worker
   * reports to nobody: its port stays open and every call after it hangs.
   */
  async probeFontWidths(): Promise<number[]> {
    return measureFontProbe(this.createToWidth());
  }

  async render(request: ExportPngRequest): Promise<RenderPngResult> {
    const toWidth = this.createMatchingToWidth(request.fontProbe);

    return renderDocumentPng({ ...request, toWidth });
  }

  /**
   * The document as an svg, laid out by the same measure the png is. Its text
   * is placed where this realm wrapped and cut it, so the probe gates it too.
   */
  async renderSvg(request: ExportSvgRequest): Promise<string> {
    const toWidth = this.createMatchingToWidth(request.fontProbe);

    return renderDocumentSvg({ ...request, toWidth });
  }

  /**
   * This realm's measure, once it is shown to lay the probe out as the asking
   * realm did. Every drawing a request asks for goes through it first.
   */
  private createMatchingToWidth(fontProbe: number[]): ToWidth {
    const toWidth = this.createToWidth();
    const probe = measureFontProbe(toWidth);
    if (!sameFontProbe(probe, fontProbe)) {
      throw new Error(
        `[export-png] this realm measures text differently: ${probe.join()} against ${fontProbe.join()}`
      );
    }

    return toWidth;
  }

  private createToWidth(): ToWidth {
    const toWidth = createOffscreenToWidth();
    if (!toWidth) {
      throw new Error(
        '[export-png] this realm has no 2d context to measure by'
      );
    }

    return toWidth;
  }
}
