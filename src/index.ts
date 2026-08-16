import * as vscode from 'vscode';
import { REFERENCE_TYPE, ReferenceType, References } from './reference';

// [minecraft path, type(参照タイプ or "tags/function"), 拡張子]
export type McPath = [path: string, type: string, suffix: string];

function createReferences(): References {
    return Object.fromEntries(
        REFERENCE_TYPE.map(type => [type, new Set<vscode.Uri>()])
    ) as References;
}

class DatapackIndex {
    private allFiles = new Set<vscode.Uri>();
    private uriToPath = new Map<vscode.Uri, McPath>();
    private pathToUri = new Map<string, vscode.Uri>();
    private refs = new Map<vscode.Uri, References>();

    /** 再スキャン前に必ず呼ぶ。全状態を初期化する */
    clear(): void {
        this.allFiles.clear();
        this.uriToPath.clear();
        this.pathToUri.clear();
        this.refs.clear();
    }

    /** Uri ⇔ mcPath の対応を登録する(旧 createPathDictionary の中身) */
    register(uri: vscode.Uri, mcPath: McPath): void {
        this.allFiles.add(uri);
        this.uriToPath.set(uri, mcPath);
        this.pathToUri.set(mcPath[0], uri);
    }

    getPath(uri: vscode.Uri): McPath | undefined {
        return this.uriToPath.get(uri);
    }

    getUri(path: string): vscode.Uri | undefined {
        return this.pathToUri.get(path);
    }

    /** DocumentLinkProvider でのループ用 */
    getAllUris(): IterableIterator<vscode.Uri> {
        return this.allFiles.values();
    }

    /** 旧 reference.ts の addReference と同一挙動 */
    addReference(sourceUri: vscode.Uri, type: ReferenceType, targetUri: vscode.Uri): void {
        let references = this.refs.get(sourceUri);
        if (!references) {
            references = createReferences();
            this.refs.set(sourceUri, references);
        }
        references[type].add(targetUri);
    }

    /** header.ts の createHeader で使う */
    getReferences(uri: vscode.Uri): References | undefined {
        return this.refs.get(uri);
    }
}

export const datapackIndex = new DatapackIndex();