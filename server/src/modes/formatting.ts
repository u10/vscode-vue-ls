/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument, Range, TextEdit, FormattingOptions, Position } from 'vscode-languageserver-types';
import { LanguageModes, Settings } from './languageModes';
import { pushAll } from '../utils/arrays';
import { isEOL } from '../utils/strings';
import * as JsDiff from 'diff'
import * as prettier from 'prettier'

const prettierOpts: {[id: string]: prettier.Options} = {
	'javascript': {
		parser: 'babylon',
		semi: false,
		singleQuote: true
	},
	'typescript': {
		parser: 'typescript',
		semi: false,
		singleQuote: true
	},
	'css': {
		parser: 'css'
	},
	'less': {
		parser: 'less'
	},
	'scss': {
		parser: 'scss'
	}
}

export function format(languageModes: LanguageModes, document: TextDocument, formatRange: Range, formattingOptions: FormattingOptions, settings: Settings, enabledModes: { [mode: string]: boolean }) {
	let result: TextEdit[] = [];

	let endPos = formatRange.end;
	let endOffset = document.offsetAt(endPos);
	let content = document.getText();
	if (endPos.character === 0 && endPos.line > 0 && endOffset !== content.length) {
		// if selection ends after a new line, exclude that new line
		let prevLineStart = document.offsetAt(Position.create(endPos.line - 1, 0));
		while (isEOL(content, endOffset - 1) && endOffset > prevLineStart) {
			endOffset--;
		}
		formatRange = Range.create(formatRange.start, document.positionAt(endOffset));
	}

	// run the html formatter on the full range and pass the result content to the embedded formatters.
	// from the final content create a single edit
	// advantages of this approach are
	//  - correct indents in the html document
	//  - correct initial indent for embedded formatters
	//  - no worrying of overlapping edits

	let allRanges = languageModes.getModesInRange(document, formatRange);

	let i = 0;
	let startPos = formatRange.start;
	while (i < allRanges.length) {
		let range = allRanges[i];
		const languageId = range.mode.getId()
		if (enabledModes[languageId]) {
			if (range.mode.format) {
				let edits = range.mode.format(document, Range.create(startPos, range.end), formattingOptions, settings);
				pushAll(result, edits);
			} else if (prettierOpts[languageId]) {
				let start = document.offsetAt(range.start);
				let end = document.offsetAt(range.end);
				const textDocContent = document.getText().substring(start, end)
				const edits = []
				const diff = JsDiff.diffChars(textDocContent, `\n  ${prettier.format(textDocContent, prettierOpts[languageId]).replace(/\n$/, '').replace(/\n/g, '\n  ')}\n`)
				let offset = start
				for (let item of diff) {
					if (item.added || item.removed) {
						edits.push({
							range: {
								start: document.positionAt(offset),
								end: document.positionAt(offset + (item.added ? 0 : item.count))
							},
							newText: item.removed ? '' : item.value
						})
					}
					if (!item.added) {offset += item.count}
				}
				pushAll(result, edits);
			}
		}
		startPos = range.end;
		i++;
	}
	return result;
}
