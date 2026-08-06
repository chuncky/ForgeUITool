/** FR-090～093: whitelist of action types allowed inside A2 UI packages. */

export const PACKAGE_LOGIC_ACTION_WHITELIST = [
  "CHANGE_SCREEN",
  "SET_PROP",
  "SET_VAR",
  "SWITCH_LANGUAGE",
  "PLAY_ANIMATION",
] as const;

export type PackageLogicActionType = (typeof PACKAGE_LOGIC_ACTION_WHITELIST)[number];

/** Host-only actions must stay in firmware custom/ (never in package logic). */
export const FIRMWARE_ONLY_ACTIONS = ["CALL_FUNCTION"] as const;

export function isPackageAllowedAction(type: string): boolean {
  return (PACKAGE_LOGIC_ACTION_WHITELIST as readonly string[]).includes(type);
}

export function isFirmwareOnlyAction(type: string): boolean {
  return (FIRMWARE_ONLY_ACTIONS as readonly string[]).includes(type);
}

export interface PackageLogicManifest {
  schemaVersion: string;
  allowedActions: string[];
  firmwareOnlyActions: string[];
  note: string;
}

export function buildPackageLogicManifest(): PackageLogicManifest {
  return {
    schemaVersion: "1",
    allowedActions: [...PACKAGE_LOGIC_ACTION_WHITELIST],
    firmwareOnlyActions: [...FIRMWARE_ONLY_ACTIONS],
    note: "AC-013 / FR-090～093: package may carry whitelist actions; CALL_FUNCTION stays in firmware symbol table",
  };
}
