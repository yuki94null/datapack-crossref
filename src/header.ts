import * as vscode from 'vscode';
import { REFERENCE_TYPE } from "./reference";
import { makePath, escapeRegExp } from "./extension";
import { datapackIndex } from "./index";

export const HEADER_PREFIX = '#||';
export const HEADER_SUFFIX = '||#';
export const HEADER_START = HEADER_PREFIX + " --- CrossRefs --- " + HEADER_SUFFIX;
export const HEADER_END = HEADER_PREFIX + " ------ End ------ " + HEADER_SUFFIX + "\n";


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
	let result = input;

	const headerRegex = new RegExp(
		escapeRegExp(HEADER_START) +
		"[\\s\\S]*?" +
		escapeRegExp(HEADER_END)
	);

	result = result.replace(headerRegex, "");

	const prefixRegex = new RegExp(
		"^" + escapeRegExp(HEADER_PREFIX) + ".*\\r?\\n",
		"gm"
	);

	result = result.replace(prefixRegex, "");

	return result;
}

export function createHeader(input: vscode.Uri): string {
    let result: string = "";
    let addTexts: string[] = [];
    const indent = "    ";

    let thisUri = makePath(input)[0];

    addTexts.push(HEADER_START);
    addTexts.push(" @" + thisUri);
    addTexts.push("");

    const refs = datapackIndex.getReferences(input);

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
    addTexts.push(HEADER_END.slice(3, HEADER_END.length));

    result = addTexts.join("\n" + HEADER_PREFIX);

    return result;
}
