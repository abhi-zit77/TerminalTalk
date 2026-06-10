#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./ui/App.js";
import {
  ENTER_ALTERNATE_SCREEN,
  EXIT_ALTERNATE_SCREEN,
  writeTerminalSequence
} from "./ui/terminalScreen.js";

writeTerminalSequence(ENTER_ALTERNATE_SCREEN);

const instance = render(<App />);
let didRestoreTerminal = false;

const restoreTerminal = (): void => {
  if (didRestoreTerminal) {
    return;
  }

  didRestoreTerminal = true;
  writeTerminalSequence(EXIT_ALTERNATE_SCREEN);
};

void instance.waitUntilExit().finally(restoreTerminal);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    restoreTerminal();
    process.kill(process.pid, signal);
  });
}
