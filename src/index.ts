import * as vscode from 'vscode';

class DatapackIndex {
    private allFiles = new Set<vscode.Uri>();
    private uriToPath = new Map<vscode.Uri, string[]>();
    private pathToUri = new Map<string, vscode.Uri>();
    private refs = new Map<vscode.Uri, References>();

    clear() { /* ... */ }
    register(uri: vscode.Uri, path: string[]) { /* ... */ }
    addReference(source: vscode.Uri, type: string, target: vscode.Uri) { /* ... */ }
    getByPath(path: string) { /* ... */ }
}