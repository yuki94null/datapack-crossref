import path from 'node:path';
import * as vscode from 'vscode';
import { ref, REFERENCE_TYPE } from "./reference";
import { start } from 'node:repl';
import { readFile, makePath, UriToMcPath, McPathToUri } from "./extension";


export const HEADER_START = "#|| --- CrossRefs --- ||#";
export const HEADER_END =   "#|| ------ End ------ ||#";

export function hasHeader(input: string): boolean {
    const hasStart: boolean = input.includes(HEADER_START);
    const hasEnd: boolean = input.includes(HEADER_END);

    if (hasStart !== hasEnd) { return false; } // ヘッダ足りない

    if (!hasStart) { return false; } // ヘッダない

    const startIndex = input.indexOf(HEADER_START);
    const endIndex = input.indexOf(HEADER_END);

    if (startIndex > endIndex) { return false; } // 順序おかしい

    return true;
}

export function removeHeader(input: string): string {

    if (!hasHeader(input)) { return input; }

    const startIndex = input.indexOf(HEADER_START);
    const endIndex = input.indexOf(HEADER_END);

    return (
        input.slice(0, startIndex) +
        input.slice(endIndex + HEADER_END.length)
    );
}

export function createHeader(input: vscode.Uri): string {
    let result: string = "";
    let addTexts: string[] = [];
    const indent = "    ";

    let thisUri = makePath(input)[0];

    addTexts.push(HEADER_START);
    addTexts.push(" @" + thisUri);
    addTexts.push("");

    const refs = ref.get(input);

    if (refs) {

        for (const type of REFERENCE_TYPE) {
            const uris = refs[type];


            if (!(uris.size > 0)) { continue; }
            addTexts.push(indent + "# " + type);

            for (const uri of uris) {
                const uriPath = makePath(uri)[0];
                addTexts.push(indent + indent + "@" + uriPath);
            }

            addTexts.push("");
        }
    }
    addTexts.push("");
    addTexts.push(HEADER_END.slice(3, HEADER_END.length));

    result = addTexts.join("\n#||");

    return result;
}
