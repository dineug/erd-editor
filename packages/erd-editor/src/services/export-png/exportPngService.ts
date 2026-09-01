import {
  renderDocumentPng,
  type RenderPngRequest,
  type RenderPngResult,
} from './renderPng';
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
    return measureFontProbe(this.toWidth());
  }

  async render(request: ExportPngRequest): Promise<RenderPngResult> {
    const toWidth = this.toWidth();
    const probe = measureFontProbe(toWidth);
    if (!sameFontProbe(probe, request.fontProbe)) {
      throw new Error(
        `[export-png] this realm measures text differently: ${probe.join()} against ${request.fontProbe.join()}`
      );
    }

    return renderDocumentPng({ ...request, toWidth });
  }

  private toWidth(): ToWidth {
    const toWidth = createOffscreenToWidth();
    if (!toWidth) {
      throw new Error(
        '[export-png] this realm has no 2d context to measure by'
      );
    }

    return toWidth;
  }
}
