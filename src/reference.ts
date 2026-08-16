import * as vscode from 'vscode';

export const REFERENCE_TYPE: string[] = [
    "tags/function",
    "function",
    "advancement",
    "dialog",
    "enchantment",
    "loot_table",
    "recipe",
    "item_modifier",
];

export type References = Record<string, Set<vscode.Uri>>;
export type ReferenceType = typeof REFERENCE_TYPE[number];
