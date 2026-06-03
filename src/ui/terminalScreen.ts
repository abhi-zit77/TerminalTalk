export const ENTER_ALTERNATE_SCREEN =
  "\u001B[?1049h\u001B[2J\u001B[H\u001B[?25l\u001B[?1000h\u001B[?1006h";
export const EXIT_ALTERNATE_SCREEN = "\u001B[?1006l\u001B[?1000l\u001B[?25h\u001B[?1049l";

export function writeTerminalSequence(sequence: string): void {
  if (process.stdout.isTTY) {
    process.stdout.write(sequence);
  }
}
