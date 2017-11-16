/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { DocumentContext } from 'vscode-html-languageservice';
import {
	CompletionItem, Location, SignatureHelp, Definition, TextEdit, TextDocument, Diagnostic, DocumentLink, Range,
	Hover, DocumentHighlight, CompletionList, Position, FormattingOptions, SymbolInformation
} from 'vscode-languageserver-types';

import { ColorInformation, ColorPresentation } from 'vscode-languageserver-protocol/lib/protocol.colorProvider.proposed';

import { getLanguageModelCache, LanguageModelCache } from '../languageModelCache';
import { getDocumentRegions } from './embeddedSupport';
import { getCSSMode } from './cssMode';
import { getJavascriptMode } from './javascriptMode';
import { getHTMLMode } from './htmlMode';
import { getVueMode } from './vueMode';

export { ColorInformation, ColorPresentation };

export interface Settings {
	'vue-ls'?: any;
	html?: any;
	css?: any;
	javascript?: any;
}

export interface SettingProvider {
	getDocumentSettings(textDocument: TextDocument): Thenable<Settings>;
}

export interface LanguageMode {
	getId(): string;
	configure?: (options: Settings) => void;
	doValidation?: (document: TextDocument, settings?: Settings) => Diagnostic[];
	doComplete?: (document: TextDocument, position: Position, settings?: Settings) => CompletionList;
	doResolve?: (document: TextDocument, item: CompletionItem) => CompletionItem;
	doHover?: (document: TextDocument, position: Position) => Hover;
	doSignatureHelp?: (document: TextDocument, position: Position) => SignatureHelp;
	findDocumentHighlight?: (document: TextDocument, position: Position) => DocumentHighlight[];
	findDocumentSymbols?: (document: TextDocument) => SymbolInformation[];
	findDocumentLinks?: (document: TextDocument, documentContext: DocumentContext) => DocumentLink[];
	findDefinition?: (document: TextDocument, position: Position) => Definition;
	findReferences?: (document: TextDocument, position: Position) => Location[];
	format?: (document: TextDocument, range: Range, options: FormattingOptions, settings: Settings) => TextEdit[];
	findDocumentColors?: (document: TextDocument) => ColorInformation[];
	getColorPresentations?: (document: TextDocument, colorInfo: ColorInformation) => ColorPresentation[];
	doAutoClose?: (document: TextDocument, position: Position) => string;
	onDocumentRemoved(document: TextDocument): void;
	dispose(): void;
}

export interface LanguageModes {
	getModeAtPosition(document: TextDocument, position: Position): LanguageMode;
	getModesInRange(document: TextDocument, range: Range): LanguageModeRange[];
	getAllModes(): LanguageMode[];
	getAllModesInDocument(document: TextDocument): LanguageMode[];
	getMode(languageId: string): LanguageMode;
	onDocumentRemoved(document: TextDocument): void;
	dispose(): void;
}

export interface LanguageModeRange extends Range {
	mode: LanguageMode;
	attributeValue?: boolean;
}

export function getLanguageModes(env: {appRoot: string}): LanguageModes {
	const documentRegions = getLanguageModelCache(
			10,
			60,
			document => getDocumentRegions(env, document));

	let modelCaches: LanguageModelCache<any>[] = [];
	modelCaches.push(documentRegions);

	let modes: {
		[key: string]: LanguageMode;
	} = {};
	modes.vue = getVueMode();
	modes.html = getHTMLMode(documentRegions);
	modes.css = getCSSMode(documentRegions);
	modes.scss = getCSSMode(documentRegions, 'scss');
	modes.less = getCSSMode(documentRegions, 'less');
	modes.javascript = getJavascriptMode(env, documentRegions);
	modes.typescript = {
		getId: () => 'typescript',
		onDocumentRemoved () {},
		dispose () {}
	};
	return {
		getModeAtPosition(document: TextDocument, position: Position): LanguageMode {
			let languageId = documentRegions.get(document).getLanguageAtPosition(position);
			if (languageId) {
				return modes[languageId];
			}
			return null;
		},
		getModesInRange(document: TextDocument, range: Range): LanguageModeRange[] {
			let result = [];
			for (let item of documentRegions.get(document).getLanguageRanges(range)) {
				let mode = modes[item.languageId];
				if (mode) {
					result.push({
						start: item.start,
						end: item.end,
						mode
					});
				}
			}
			return result;
		},
		getAllModesInDocument(document: TextDocument): LanguageMode[] {
			let result = [];
			for (let languageId of documentRegions.get(document).getLanguagesInDocument()) {
				let mode = modes[languageId];
				if (mode) {
					result.push(mode);
				}
			}
			return result;
		},
		getAllModes(): LanguageMode[] {
			let result = [];
			for (let languageId in modes) {
				let mode = modes[languageId];
				if (mode) {
					result.push(mode);
				}
			}
			return result;
		},
		getMode(languageId: string): LanguageMode {
			return modes[languageId];
		},
		onDocumentRemoved(document: TextDocument) {
			modelCaches.forEach(mc => mc.onDocumentRemoved(document));
			for (let mode in modes) {
				modes[mode].onDocumentRemoved(document);
			}
		},
		dispose(): void {
			modelCaches.forEach(mc => mc.dispose());
			modelCaches = [];
			for (let mode in modes) {
				modes[mode].dispose();
			}
			modes = {};
		}
	};
}
