export const COMMAND_PALETTE_OPEN_EVENT = "finos:command-palette.open";

export function requestCommandPaletteOpen() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
}

export function getCommandPaletteShortcutLabel() {
  const platform =
    typeof navigator === "undefined"
      ? ""
      : `${navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || ""}`.toLowerCase();
  return platform.includes("mac") ? "Cmd K" : "Ctrl K";
}
