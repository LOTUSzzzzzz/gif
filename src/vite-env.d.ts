/// <reference types="vite/client" />

declare module "gifenc" {
  export function GIFEncoder(opts?: {
    auto?: boolean;
    initialCapacity?: number;
  }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>,
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}

declare module "gifsicle-wasm" {
  const createGifsicle: (opts?: { wasmBinary?: ArrayBuffer }) => Promise<unknown>;
  export default createGifsicle;
}

declare module "gifsicle-wasm/gifsicle.wasm?url" {
  const url: string;
  export default url;
}
