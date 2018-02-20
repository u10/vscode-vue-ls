/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path'
import { TextDocument, Position, Range } from 'vscode-html-languageservice';
import { repeat } from '../utils/strings';

export interface LanguageRange extends Range {
	languageId: string;
	attributeValue?: boolean;
}

export interface VueDocumentRegions {
	getEmbeddedDocument(languageId: string, isTopLevel?: boolean): TextDocument;
	getLanguageRanges(range: Range): LanguageRange[];
	getLanguageAtPosition(position: Position): string;
	getLanguagesInDocument(): string[];
	getImportedScripts(): string[];
}

export var CSS_STYLE_RULE = '__';

interface EmbeddedRegion { firstLanguageId: string; lastLanguageId: string; start: number; end: number;};

function getNodeModule (appRoot: string, moduleName: string) {
	try {
		return require(`${appRoot}/node_modules.asar/${moduleName}`);
	} catch(err) {}
	try {
		return require(`${appRoot}/node_modules/${moduleName}`);
	} catch(err) {}
	throw new Error(`Can not find module: ${moduleName}`)
}

export function getDocumentRegions(env: {appRoot: string}, document: TextDocument): VueDocumentRegions {
	const tm = getNodeModule(env.appRoot, 'vscode-textmate')

	let regions: EmbeddedRegion[] = [];
	let importedScripts: string[] = [];

	const config: IVSCodeContributes = require(path.resolve(__dirname, '../../package.json')).contributes
	const vueGrammarConfig = config.grammars.find((item) => item.language === 'vue')
	const grammar = (new tm.Registry()).loadGrammarFromPathSync(
		path.resolve(__dirname, '../..', vueGrammarConfig.path)
	)
	const tokens = grammar.tokenizeLine(document.getText()).tokens;

	let lastRegions: EmbeddedRegion = {firstLanguageId: null, lastLanguageId: null ,start: 0, end: 0};
	for (let token of tokens) {
		let firstLanguageId;
		let lastLanguageId;
		for (let scope of token.scopes) {
			const languageId = vueGrammarConfig.embeddedLanguages[scope];
			if (languageId) {
				if (!firstLanguageId) {firstLanguageId = languageId}
				lastLanguageId = languageId
			}
		}
		firstLanguageId = firstLanguageId || 'vue'
		lastLanguageId = lastLanguageId || 'vue'
		if (lastLanguageId === lastRegions.lastLanguageId) {
			lastRegions.end = token.endIndex;
		} else {
			lastRegions = {
				firstLanguageId,
				lastLanguageId,
				start: token.startIndex,
				end: token.endIndex
			}
			regions.push(lastRegions);
		}
	}

	return {
		getLanguageRanges: (range: Range) => getLanguageRanges(document, regions, range),
		getEmbeddedDocument: (languageId: string, isTopLevel?: boolean) => getEmbeddedDocument(document, regions, languageId, isTopLevel),
		getLanguageAtPosition: (position: Position) => getLanguageAtPosition(document, regions, position),
		getLanguagesInDocument: () => getLanguagesInDocument(document, regions),
		getImportedScripts: () => importedScripts
	};
}

function pushLanguageRange(target: LanguageRange[], lastLanguageRange: LanguageRange, languageId: string, start: Position, end: Position) {
	if (lastLanguageRange.languageId === languageId) {
		lastLanguageRange.end = end
	} else {
		lastLanguageRange = {
			languageId: languageId,
			start,
			end
		}
		target.push(lastLanguageRange);
	}
	return lastLanguageRange
}

function getLanguageRanges(document: TextDocument, regions: EmbeddedRegion[], range: Range): LanguageRange[] {
	let result: LanguageRange[] = [];
	let currentStart = range ? document.offsetAt(range.start) : 0;
	let currentEnd = range ? document.offsetAt(range.end) : document.getText().length;
	let lastLanguageRange: LanguageRange = {languageId: null, start: null, end: null}
	for (let region of regions) {
		if (region.start < currentEnd && region.end > currentStart) {
			let start = Math.max(region.start, currentStart);
			let startPos = document.positionAt(start);
			let end = Math.min(region.end, currentEnd);
			let endPos = document.positionAt(end);
			if (end > region.start) {
				lastLanguageRange = pushLanguageRange(result, lastLanguageRange, region.firstLanguageId, startPos, endPos);
			}
			currentStart = end;
		}
	}
	return result;
}

function getLanguagesInDocument(_: TextDocument, regions: EmbeddedRegion[]): string[] {
	let result = [];
	for (let region of regions) {
		if (region.lastLanguageId && result.indexOf(region.lastLanguageId) === -1) {
			result.push(region.lastLanguageId);
		}
	}
	return result;
}

function getLanguageAtPosition(document: TextDocument, regions: EmbeddedRegion[], position: Position): string {
	let offset = document.offsetAt(position);
	for (let region of regions) {
		if (offset >= region.start && offset <= region.end) {
			return region.lastLanguageId;
		}
	}
	return 'vue';
}

function addRegionCode(region: EmbeddedRegion, result: string, oldContent: string) {
	if (region.lastLanguageId !== region.firstLanguageId) {
		switch (region.lastLanguageId) {
			case 'css':
			{
				const content = `{${oldContent.substring(region.start + 1, region.end - 1)}}`
				const prefix = CSS_STYLE_RULE
				const len = prefix.length
				const regExp = new RegExp(`(?=\\n {0,${len - 1}}$)| {${len}}$`)
				return result.replace(regExp, prefix) + content;
			}
		}
	}
	return result + oldContent.substring(region.start, region.end)
}

function getEmbeddedDocument(document: TextDocument, contents: EmbeddedRegion[], languageId: string, isTopLevel: boolean = true): TextDocument {
	let oldContent = document.getText();
	let result = '';
	let line = 0;
	let character = 0
	for (let region of contents) {
		if (languageId === (isTopLevel ? region.firstLanguageId : region.lastLanguageId)) {
			let ps = document.positionAt(region.start)
			let pe = document.positionAt(region.end)
			if (ps.line === line) {
				result += repeat(' ', ps.character - character)
			} else {
				result += repeat('\n', ps.line - line)
				result += repeat(' ', ps.character)
			}
			result = addRegionCode(region, result, oldContent)
			line = pe.line
			character = pe.character
		}
	}
	return TextDocument.create(document.uri, languageId, document.version, result);
}
