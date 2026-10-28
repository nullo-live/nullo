/*
 * Browser storage keys. Deliberately neutral (not the brand name), so renaming the project never
 * orphans what visitors' browsers already hold: saved projects, deploy progress, the wallet choice.
 */
const PREFIX = "nl1";
export const storageKey = (...parts: string[]) => [PREFIX, ...parts].join(".");
