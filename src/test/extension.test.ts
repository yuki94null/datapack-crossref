import * as assert from 'assert';
import { hasHeader, removeHeader, HEADER_START, HEADER_END, HEADER_PREFIX } from './../header';
import { escapeRegExp } from './../extension';

suite('header.ts Test Suite', () => {

	suite('hasHeader', () => {

		test('ヘッダーが無い場合は false', () => {
			assert.strictEqual(hasHeader('say hello'), false);
		});

		test('開始・終了タグが両方揃っていれば true', () => {
			const input = `${HEADER_START}\n${HEADER_PREFIX} @minecraft:example\n${HEADER_END}\nsay hello`;
			assert.strictEqual(hasHeader(input), true);
		});

		test('開始タグのみで終了タグが無い場合は false', () => {
			const input = `${HEADER_START}\nsay hello`;
			assert.strictEqual(hasHeader(input), false);
		});

		test('終了タグのみで開始タグが無い場合は false', () => {
			const input = `${HEADER_END}\nsay hello`;
			assert.strictEqual(hasHeader(input), false);
		});

		test('終了タグが開始タグより前にある場合は false', () => {
			const input = `${HEADER_END}\nsay hello\n${HEADER_START}`;
			assert.strictEqual(hasHeader(input), false);
		});
	});

	suite('removeHeader', () => {

		test('ヘッダーブロックを除去し、本文だけを残す', () => {
			const body = 'say hello\nsay world';
			const input = `${HEADER_START}\n${HEADER_PREFIX} @minecraft:example\n${HEADER_END}\n${body}`;

			assert.strictEqual(removeHeader(input), body);
		});

		test('ヘッダーが無い場合は入力をそのまま返す', () => {
			const input = 'say hello\nsay world';
			assert.strictEqual(removeHeader(input), input);
		});

		test('複数行にわたるヘッダー内容もまとめて除去する', () => {
			const input =
				`${HEADER_START}\n` +
				`${HEADER_PREFIX} @minecraft:example\n` +
				`${HEADER_PREFIX}\n` +
				`${HEADER_PREFIX}    # function\n` +
				`${HEADER_PREFIX}        @minecraft:caller\n` +
				`${HEADER_END}\n` +
				`say hello`;

			assert.strictEqual(removeHeader(input), 'say hello');
		});
	});
});

suite('extension.ts Test Suite', () => {

	suite('escapeRegExp', () => {

		test('正規表現の特殊文字をエスケープする', () => {
			assert.strictEqual(escapeRegExp('a.b*c'), 'a\\.b\\*c');
		});

		test('特殊文字が無い文字列はそのまま返す', () => {
			assert.strictEqual(escapeRegExp('minecraft:example/main'), 'minecraft:example/main');
		});

		test('minecraftパス中の記号を含む文字列も正しく処理する', () => {
			const input = 'minecraft:example/(test)';
			const escaped = escapeRegExp(input);

			// エスケープ後の文字列を正規表現として使っても例外が出ないことを確認
			assert.doesNotThrow(() => new RegExp(escaped));
			assert.strictEqual(new RegExp(escaped).test(input), true);
		});
	});
});