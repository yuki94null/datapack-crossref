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

type References = Record<string, Set<vscode.Uri>>;

export const ref = new Map<vscode.Uri, References>();

function createReference(): References {
    return Object.fromEntries(REFERENCE_TYPE.map(type => [type, new Set<vscode.Uri>()])) as References;
}

export function addReference(sourceUri: vscode.Uri, type: string, targetUri: vscode.Uri) {
    if (!REFERENCE_TYPE.includes(type)) { throw new Error("Invalid Type"); }

    let references = ref.get(sourceUri);

    if (!references) {
        references = createReference();
        ref.set(sourceUri, references);
    }

    references[type].add(targetUri);
}