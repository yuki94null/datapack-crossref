import path from 'node:path';
import * as vscode from 'vscode';

const map = new Map<vscode.Uri, string[]>();

async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
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

		const paths = await getFiles(dataUri);

		for (const item of paths) {
			console.log(makePath(item));
			map.set(item, makePath(item));

			await findFuncInFile(item);
		}

		console.log("終わり");
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
		} else {
			results.push(childUri);
		}
	}
	return results;
}

function makePath(input: vscode.Uri): string[] {

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

async function readFile(input: vscode.Uri): Promise<Thenable<string>> {
	const content = await vscode.workspace.fs.readFile(input);
	const decoded = await vscode.workspace.decode(content);

	return decoded;
}

async function findFuncInFile(input: vscode.Uri): Promise<string[]> {

	let results: string[] = [];
	const paths = map.get(input); // 辞書から探す

	if (!paths) { return results; }

	if (!(["json", "mcfunction"].includes(paths[2]))) { return results; } // 拡張子が`json`か`mcfunction`でなければやめる

	const file = await readFile(input); // 中の文字列取得

	if (["json"].includes(paths[2])) { // json系の処理

		try {
			const json = JSON.parse(file); // json形式として扱う

			if (["tags/function"].includes(paths[1])) { //  リストの中の生の値か、{}.idを取る
				results = json["values"].filter((value: unknown) => {
					if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string") {
						return value.id;
					}
					return value;
				}
				);
			} else if (["advancement"].includes(paths[1])) { // advancement: rewards.functionの中身があれば良い
				results = 
					pickFuncInCommand(findObjectInJson(json["display"], "action", "command", "run_command")).concat(
					json["rewards"]["function"]);

			} else if (["enchantment"].includes(paths[1])) { // enchantments: effects下のrun_functionと同じところのfunctionを取る
				results =
					pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command")).concat(
						pickFuncInCommand(findObjectInJson(json, "type", "function", "run_function"))
					);

			} else if (["dialog"].includes(paths[1])) { // "command"の中身がfunctionであれば取る
				results =
					pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command")).concat(
						pickFuncInCommand(findObjectInJson(json, "type", "command", "run_command"))
					);

			} else if (["loot_table"].includes(paths[1])) { // "command"の中身がfunctionであれば取る
				results = pickFuncInCommand(findObjectInJson(json, "action", "command", "run_command"));

			} else if (["recipe"].includes(paths[1])) { // "command"の中身がfunctionであれば取る
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

	console.log(paths[1]);
	console.log("result: " + results);
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