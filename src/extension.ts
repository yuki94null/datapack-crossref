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

			readFile(item);
		}

		console.log("終わり");
	});
}

// functions

async function getFiles(uri: vscode.Uri): Promise<vscode.Uri[]> {

	const result: vscode.Uri[] = [];
	const data = await vscode.workspace.fs.readDirectory(uri);

	for (const [name, type] of data) {
		const childUri = vscode.Uri.joinPath(uri, name);

		if (type === vscode.FileType.Directory) {
			const children = await getFiles(childUri);
			result.push(...children);
		} else {
			result.push(childUri);
		}
	}
	return result;
}

function makePath(input: vscode.Uri): string[] {

	const rel = vscode.workspace.asRelativePath(input);
	let items = rel.split('/');

	const namespace = items[1];
	const type = items[2];

	let file = items[items.length - 1].split('.');
	const suffix = file.pop() ?? '';
	items[items.length - 1] = file.join('.');

	items.splice(0, 3);

	let path = namespace + ":" + items.join('/');

	return [path, type, suffix];
}

async function readFile(input: vscode.Uri): Promise<Thenable<string>>
{
	const items = await vscode.workspace.fs.readFile(input);
	const decoded = vscode.workspace.decode(items);

	console.log("items: " + items + "\ndecoded: " + decoded);
	return decoded;
}
export function deactivate() { }
