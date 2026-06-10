export interface RawInputLike {
  isTTY?: boolean | undefined;
  setRawMode?: unknown;
}

export function isRawInputSupported(input: RawInputLike): boolean {
  return input.isTTY === true && typeof input.setRawMode === "function";
}
