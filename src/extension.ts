import path from 'node:path';
import * as vscode from 'vscode';
import { addReference, ref, REFERENCE_TYPE } from "./reference";
import { removeHeader, createHeader } from "./header";

export const UriToMcPath = new Map<vscode.Uri, string[]>();
export const McPathToUri = new Map<string, vscode.Uri>();

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
	
export function activate(context: vscode.ExtensionContext) {


	console.log('Congratulations, your extension "datapack-crossref" is now active!');

	context.subscriptions.push(
		vscode.commands.registerCommand('datapack-crossref.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from datapack-crossref!');
		})
	);

	vscode.commands.registerCommand('datapack-crossref.scanDatapack', async () => {
		const wf = vscode.workspace.workspaceFolders;

		if (!wf) {
			vscode.window.showErrorMessage('No WorkSpace Here');
			return;
		};

		const mcmetaUri = vscode.Uri.joinPath(wf[0].uri, 'pack.mcmeta');

		if (!(await fileCheck(mcmetaUri) === vscode.FileType.File)) {
			vscode.window.showErrorMessage('This is not Datapack Workspace');
			return;
		}

		const dataUri = vscode.Uri.joinPath(wf[0].uri, "data");

		const dataUris = await getFiles(dataUri);

		for (const uri of dataUris) { // 辞書作る
			const itemPaths = makePath(uri);
			UriToMcPath.set(uri, itemPaths);
			McPathToUri.set(itemPaths[0], uri);
		}

		for (const uri of dataUris) {

			const mcPath = UriToMcPath.get(uri);

			if (mcPath === undefined) {
				throw new Error("Invalid McPath");
			}
			const includeMcPaths = await findFuncInFile(uri);

			for (const includeMcPath of includeMcPaths) {

				const includeUri = McPathToUri.get(includeMcPath);

				if (includeUri === undefined) {
					throw new Error("Invalid Uri");
				}
				addReference(
					includeUri,
					mcPath[1],
					uri
				);
			}
		}

		// ファイル編集
		const edit = new vscode.WorkspaceEdit();
		for (const uri of dataUris) {
			const McPath = UriToMcPath.get(uri);
			if (typeof McPath === "undefined") { throw new Error("Invalid McPath"); }
			if (McPath[2] !== "mcfunction") { continue; }

			const header = createHeader(uri);
			const body = removeHeader(await readFile(uri));

			const newText = header + body;


			const document = await vscode.workspace.openTextDocument(uri);

			edit.replace(
				uri,
				new vscode.Range(
					document.positionAt(0),
					document.positionAt(document.getText().length)
				),
				newText
			);
		}
		await vscode.workspace.applyEdit(edit);
	});
}

// functions

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

async function findFuncInFile(input: vscode.Uri): Promise<string[]> {

	let results: string[] = [];
	const paths = UriToMcPath.get(input); // 辞書から探す

	if (!paths) { return results; }

	if (!(["json", "mcfunction"].includes(paths[2]))) { return results; } // 拡張子が`json`か`mcfunction`でなければやめる

	const file = await readFile(input); // 中の文字列取得

	if (["json"].includes(paths[2])) { // json系の処理

		try {
			const json = JSON.parse(file); // json形式として扱う

			if (["tags/function"].includes(paths[1])) { //  リストの中の生の値か、{}.idを取る
				for (const value of json["values"]) {
					if (typeof value === "string") { results.push(value); }

					else if (
						value !== null &&
						typeof value === "object" &&
						"id" in value &&
						typeof value.id === "string") { results.push(value.id); }
				}

			} else if (["advancement"].includes(paths[1])) { // advancement: rewards.functionの中身があれば良い
				results =
					pickFuncInCommand(findObjectInJson(json["display"], "action", "command", "run_command")).concat(
						json["rewards"]["function"]
					);

			} else if (["enchantment"].includes(paths[1])) { // enchantments: effects下のrun_functionと同じところのfunctionを取る
				results =
					pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command")).concat(
						findObjectInJson(json["effects"], "type", "function", "run_function")
					);

			} else if (["dialog"].includes(paths[1])) { // "command"の中身がfunctionであれば取る
				results =
					pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command")).concat(
						pickFuncInCommand(findObjectInJson(json, "type", "command", "run_command"))
					);

			} else if (["loot_table", "recipe", "item_modifier"].includes(paths[1])) { // "command"の中身がfunctionであれば取る
				results = pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command"));

			}
		} catch {
			vscode.window.showErrorMessage(paths[0] + " is invalid");
			console.warn("invalid structure: " + input);
		}
	}
	else if (paths[1] === "function") {
		let commands = textToCommand(file);
		results = pickFuncInCommand(commands);
	}
	return results;
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

export function deactivate() { }