import * as vscode from 'vscode';
import { REFERENCE_TYPE, ReferenceType } from "./reference";
import { removeHeader, createHeader, HEADER_START, HEADER_END, hasHeader } from "./header";
import { datapackIndex, McPath } from "./index";

export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
	const links: vscode.DocumentLink[] = [];

	const text = document.getText();

	if (!hasHeader(text)) { return links; }

	const startIndex = text.indexOf(HEADER_START);
	const endIndex = text.indexOf(HEADER_END);

	let typeIndexes: [string, number][] = [];
	for (const type of REFERENCE_TYPE) {
		const index = text.indexOf('#||    # ' + type);

		if (index !== -1) {
			typeIndexes.push([type, index]);
		}
	}
	typeIndexes.sort((a, b) => a[1] - b[1]);

	for (const uri of datapackIndex.getAllUris()) {
		const mcPath = datapackIndex.getPath(uri);
		if (typeof mcPath === "undefined") { continue; }

		const typeIndex = typeIndexes.findIndex((value) => value[0] === mcPath[1]);
		const firstTypeAreaStart = typeIndexes[0]?.[1] ?? endIndex;
		const typeAreaStart = typeIndexes[typeIndex]?.[1] ?? endIndex;
		const typeAreaEnd = typeIndexes[typeIndex + 1]?.[1] ?? endIndex;

		const regex = new RegExp('@' + escapeRegExp(mcPath[0]), 'g');

		for (const match of text.matchAll(regex)) {
			const matchStart = match.index;
			if (matchStart === undefined) {
				continue;
			}
			const matchEnd = match.index + match[0].length;

			let matchInHeader = matchStart > startIndex + HEADER_START.length && matchEnd < endIndex;

			if (!matchInHeader) { continue; }

			let matchInType = matchStart > typeAreaStart && matchEnd < typeAreaEnd;

			if (!matchInType && !(mcPath[1] === "function" && matchEnd < firstTypeAreaStart)) { continue; }

			const start = document.positionAt(matchStart);
			const end = document.positionAt(matchEnd);
			const link = new vscode.DocumentLink(new vscode.Range(start, end), uri);
			links.push(link);
		}
	}
	return links;
}

export class DocumentLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(document: vscode.TextDocument): vscode.ProviderResult<vscode.DocumentLink[]> {
		return createLinks(document);
	}
}

export function activate(context: vscode.ExtensionContext) {

	console.log('"datapack-crossref" is now active!');
	scanDatapack();

	const documentLinkProvider = vscode.languages.registerDocumentLinkProvider(
		{ scheme: "file" },
		new DocumentLinkProvider()
	);

	context.subscriptions.push(documentLinkProvider);
	context.subscriptions.push(
		vscode.commands.registerCommand('datapack-crossref.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from datapack-crossref!');
		})
	);

	vscode.commands.registerCommand('datapack-crossref.scanDatapack', scanDatapack);
	vscode.commands.registerCommand('datapack-crossref.makeCrossRef', makeCrossRef);
	vscode.commands.registerCommand('datapack-crossref.removeCrossRef', removeCrossRef);
}


// functions

async function getDatapackFiles(): Promise<vscode.Uri[] | undefined> {
	const wf = vscode.workspace.workspaceFolders;
	if (!wf) {
		vscode.window.showErrorMessage('No WorkSpace Here');
		return undefined;
	}
	const mcmetaUri = vscode.Uri.joinPath(wf[0].uri, 'pack.mcmeta');
	if (!(await fileCheck(mcmetaUri) === vscode.FileType.File)) {
		vscode.window.showErrorMessage('This is not Datapack Workspace');
		return undefined;
	}
	const dataUri = vscode.Uri.joinPath(wf[0].uri, "data");
	return await getFiles(dataUri);
}

async function scanDatapack() {
	const dataUris = await getDatapackFiles();

	if (typeof dataUris === "undefined") { return; }
	datapackIndex.clear();
	createPathDictionary(dataUris);
}

async function makeCrossRef() {
	const dataUris = await getDatapackFiles();

	if (typeof dataUris === "undefined") { return; }

	datapackIndex.clear();
	createPathDictionary(dataUris);

	await buildReference(dataUris);
	await updateHeaders(dataUris);
}

async function removeCrossRef() {
	const dataUris = await getDatapackFiles();

	if (typeof dataUris === "undefined") { return; }

	datapackIndex.clear();
	createPathDictionary(dataUris);

	await buildReference(dataUris);
	await removeHeaders(dataUris);
}

function createPathDictionary(input: vscode.Uri[]) {
	for (const uri of input) { // 辞書作る
		datapackIndex.register(uri, makePath(uri) as McPath);
	}
}


async function buildReference(input: vscode.Uri[]) {
	for (const currentUri of input) {

		const mcPath = datapackIndex.getPath(currentUri);

		if (mcPath === undefined) {
			throw new Error("Invalid mcPath");
		}
		const includeMcPaths = await findFuncInFile(currentUri);

		for (const includeMcPath of includeMcPaths) {

			const includeUri = datapackIndex.getUri(includeMcPath);

			if (includeUri === undefined) {
				console.error("Invalid Uri: " + includeMcPath);
				continue;
			}
			datapackIndex.addReference(
				includeUri,
				mcPath[1] as ReferenceType,
				currentUri
			);
		}
	}
}


async function updateHeaders(input: vscode.Uri[]) {
	// ファイル編集
	const edit = new vscode.WorkspaceEdit();
	for (const uri of input) {
		const mcPath = datapackIndex.getPath(uri);
		if (typeof mcPath === "undefined") { throw new Error("Invalid mcPath"); }
		if (mcPath[2] !== "mcfunction") { continue; }

		const header = createHeader(uri);
		const body = removeHeader(await readFile(uri));

		const newText = header + body;


		const document = await vscode.workspace.openTextDocument(uri);

		if (document.getText() !== newText) {
			edit.replace(
				uri,
				new vscode.Range(
					document.positionAt(0),
					document.positionAt(document.getText().length)
				),
				newText
			);
		}
	}
	await vscode.workspace.applyEdit(edit);
}

async function removeHeaders(input: vscode.Uri[]) {
	// ファイル編集
	const edit = new vscode.WorkspaceEdit();
	for (const uri of input) {
		const mcPath = datapackIndex.getPath(uri);
		if (typeof mcPath === "undefined") { throw new Error("Invalid mcPath"); }
		if (mcPath[2] !== "mcfunction") { continue; }

		const body = removeHeader(await readFile(uri));

		const document = await vscode.workspace.openTextDocument(uri);

		edit.replace(
			uri,
			new vscode.Range(
				document.positionAt(0),
				document.positionAt(document.getText().length)
			),
			body
		);
	}
	await vscode.workspace.applyEdit(edit);
}

async function getFiles(uri: vscode.Uri): Promise<vscode.Uri[]> {

	const results: vscode.Uri[] = [];
	const data = await vscode.workspace.fs.readDirectory(uri);

	for (const [name, type] of data) {
		const childUri = vscode.Uri.joinPath(uri, name);

		if (type === vscode.FileType.Directory) {
			const children = await getFiles(childUri);
			results.push(...children);
		} else if (type === vscode.FileType.File) {
			results.push(childUri);
		}
	}
	return results;
}

async function fileCheck(uri: vscode.Uri): Promise<vscode.FileType> {
	try {
		const stat = await vscode.workspace.fs.stat(uri);

		if (stat.type === vscode.FileType.File) {
			return vscode.FileType.File;
		}
		else if (stat.type === vscode.FileType.Directory) {
			return vscode.FileType.Directory;
		}
		else if (stat.type === vscode.FileType.SymbolicLink) {
			return vscode.FileType.SymbolicLink;
		}

		return vscode.FileType.Unknown;

	} catch {
		return vscode.FileType.Unknown;
	}
}

export function makePath(input: vscode.Uri): string[] {

	let range = 3;

	const rel = vscode.workspace.asRelativePath(input);
	let items = rel.split('/');

	const namespace = items[1];
	let type = items[2];

	if (type === "tags") {
		type = type + "/" + items[3];
		range++;
	}

	let file = items[items.length - 1].split('.');
	const suffix = file.pop() ?? '';
	items[items.length - 1] = file.join('.');

	items.splice(0, range);

	let path = namespace + ":" + items.join('/');

	return [path, type, suffix];
}

export async function readFile(input: vscode.Uri): Promise<Thenable<string>> {
	const content = await vscode.workspace.fs.readFile(input);
	const decoded = await vscode.workspace.decode(content);

	return decoded;
}

const jsonExtractors: Partial<Record<ReferenceType, (json: unknown) => string[]>> = {
	"tags/function": extractTagsFunction,
	"advancement": extractAdvancement,
	"enchantment": extractEnchantment,
	"dialog": extractDialog,
	"loot_table": extractCommandJson,
	"recipe": extractCommandJson,
	"item_modifier": extractCommandJson,
};

async function findFuncInFile(input: vscode.Uri): Promise<string[]> {
	const paths = datapackIndex.getPath(input);
	if (!paths) { return []; }

	const [mcPath, type, suffix] = paths;

	if (!["json", "mcfunction"].includes(suffix)) { return []; }

	const file = await readFile(input);
	let results: string[] = [];

	if (suffix === "json") {
		try {
			const json = JSON.parse(file);
			const extractor = jsonExtractors[type as ReferenceType];
			if (extractor) { results = extractor(json); }
		} catch {
			vscode.window.showErrorMessage(mcPath + " is invalid");
			console.warn("invalid structure: " + input);
		}
	} else if (type === "function") {
		results = pickFuncInCommand(textToCommand(file));
	}

	return results.map(normalizeNamespace);
}

function normalizeNamespace(result: string): string {
	return result.includes(":") ? result : "minecraft:" + result;
}

function textToCommand(input: string): string[] { // '\\n'(バックスラッシュ+改行)をスペースに置き換え、改行ごとにリストに変換
	return input
		.replace(/\\[ \t]*\r?\n/g, "")
		.split(/\r?\n/)
		.map(value => value.trim());
}

function pickFuncInCommand(input: string[]): string[] {
	let results: string[] = [];
	const regax = /\bfunction ((?![^ ]*\$)[^ ]+)/g;

	input.map((value: string) => results.push(...[...value.matchAll(regax)].map(match => match[1]))); // 正規表現`regax`にヒットしたもののうち、

	return results;
}

function findObjectInJson(json: unknown, key1: string, key2: string, obj: string): string[] {

	const results: string[] = [];

	if (typeof json !== "object" || json === null) {
		return results;
	}

	const record = json as Record<string, unknown>;

	if (key1 in record &&
		key2 in record &&
		(record[key1] === obj || record[key1] === "minecraft:" + obj) &&
		typeof record[key2] === "string") {
		results.push(record[key2]);
	}

	for (const value of Object.values(record)) {
		results.push(...findObjectInJson(value, key1, key2, obj));
	}

	return results;
}

function extractTagsFunction(json: unknown): string[] {
	const results: string[] = [];
	if (typeof json !== "object" || json === null || !("values" in json)) { return results; }

	const values = (json as { values: unknown }).values;
	if (!Array.isArray(values)) { return results; }

	for (const value of values) {
		if (typeof value === "string") {
			results.push(value);
		} else if (
			value !== null &&
			typeof value === "object" &&
			"id" in value &&
			typeof (value as Record<string, unknown>).id === "string"
		) {
			results.push((value as Record<string, unknown>).id as string);
		}
	}
	return results;
}

function extractAdvancement(json: unknown): string[] {
	const record = json as Record<string, unknown>;
	const fromDisplay = pickFuncInCommand(
		findObjectInJson(record["display"], "action", "command", "run_command")
	);
	const rewardFunction = (record["rewards"] as Record<string, unknown> | undefined)?.["function"];

	const results = [...fromDisplay];
	if (typeof rewardFunction === "string") { results.push(rewardFunction); }
	return results;
}

function extractEnchantment(json: unknown): string[] {
	const record = json as Record<string, unknown>;
	const fromCommands = pickFuncInCommand(
		findObjectInJson(record, "action", "command", "run_command")
	);
	const fromEffects = findObjectInJson(record["effects"], "type", "function", "run_function");
	return fromCommands.concat(fromEffects);
}

function extractDialog(json: unknown): string[] {
	const fromAction = pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command"));
	const fromType = pickFuncInCommand(findObjectInJson(json, "type", "command", "run_command"));
	return fromAction.concat(fromType);
}

function extractCommandJson(json: unknown): string[] {
	return pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command"));
}

export function deactivate() { }