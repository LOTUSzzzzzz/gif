import createGifsicle from "gifsicle-wasm";
import wasmUrl from "gifsicle-wasm/gifsicle.wasm?url";

type GifsicleModule = {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
  _malloc(size: number): number;
  _free(ptr: number): void;
  _run_gifsicle(argc: number, argv: number): number;
  stringToNewUTF8(value: string): number;
  setValue(ptr: number, value: number, type: string): void;
};

let modulePromise: Promise<GifsicleModule> | null = null;

async function getModule(): Promise<GifsicleModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const response = await fetch(wasmUrl);
      const wasmBinary = await response.arrayBuffer();
      const mod = (await createGifsicle({
        wasmBinary,
      })) as GifsicleModule;
      return mod;
    })();
  }
  return modulePromise;
}

export async function runGifsicle(
  input: Uint8Array,
  args: string[],
): Promise<Uint8Array> {
  const mod = await getModule();
  const fullArgs = ["gifsicle", ...args, "-o", "/output.gif", "/input.gif"];
  mod.FS.writeFile("/input.gif", input);
  const argv = mod._malloc((fullArgs.length + 1) * 4);
  const ptrs: number[] = [];
  try {
    for (let i = 0; i < fullArgs.length; i++) {
      const ptr = mod.stringToNewUTF8(fullArgs[i]);
      ptrs.push(ptr);
      mod.setValue(argv + i * 4, ptr, "i32");
    }
    mod.setValue(argv + fullArgs.length * 4, 0, "i32");
    const status = mod._run_gifsicle(fullArgs.length, argv);
    if (status !== 0) {
      throw new Error(`gifsicle 退出码 ${status}`);
    }
    const output = mod.FS.readFile("/output.gif");
    mod.FS.unlink("/input.gif");
    mod.FS.unlink("/output.gif");
    return output;
  } finally {
    for (const ptr of ptrs) mod._free(ptr);
    mod._free(argv);
  }
}
