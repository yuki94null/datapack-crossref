import path from 'node:path';
import * as vscode from 'vscode';
import { ref, REFERENCE_TYPE } from "./reference";
import { start } from 'node:repl';
import { readFile, makePath, UriToMcPath, McPathToUri } from "./extension";


const HEADER_START = "# --- CrossRefs --- #";
const HEADER_END = "# --- End --- #";

function hasHeader(input: string): [start: boolean, end: boolean] {
    let hasStart: boolean = input.includes(HEADER_START);
    let hasEnd: boolean = input.includes(HEADER_END);
    return [hasStart, hasEnd];
}

export function removeHeader(input: string): string {
    let headerState: [boolean, boolean] = hasHeader(input);

    if (headerState[0] !== headerState[1]) {
        throw new Error("Invalid Header" + headerState[0] + headerState[1]);
    } // ヘッダ足りない

    if (!headerState[0]) {
        return input;
    } // ヘッダない

    const startIndex = input.indexOf(HEADER_START);
    const endIndex = input.indexOf(HEADER_END);

    if (startIndex > endIndex) {
        throw new Error("Invalid Header");
    } // 順序おかしい

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
    addTexts.push(indent + "@" + thisUri);
    addTexts.push("");

    const refs = ref.get(input);

    if (refs) {

        for (const type of REFERENCE_TYPE) {
            const uris = refs[type];


            if (!(uris.size > 0)) { continue; }
            addTexts.push(indent + indent + "# " + type);

            for (const uri of uris) {
                const uriPath = makePath(uri)[0];
                addTexts.push(indent + indent + indent + "@" + uriPath);
            }
        }
    }
    addTexts.push("");
    addTexts.push(HEADER_END.slice(1, HEADER_END.length));

    result = addTexts.join("\n#");

    return result;
}
