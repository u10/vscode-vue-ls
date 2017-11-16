/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { LanguageModelCache, getLanguageModelCache } from '../languageModelCache';
import { HTMLDocument, DocumentContext, FormattingOptions, HTMLFormatConfiguration, getLanguageService } from 'vscode-html-languageservice';
import { TextDocument, Position, Range } from 'vscode-languageserver-types';
import { LanguageMode, Settings } from './languageModes';
import { VueDocumentRegions } from './embeddedSupport';
import get = require('lodash.get')
import * as JsDiff from 'diff'

export function getHTMLMode(documentRegions: LanguageModelCache<VueDocumentRegions>): LanguageMode {
	let globalSettings: Settings = {};
	let htmlLanguageService = getLanguageService();
	const embeddedTextDocuments = getLanguageModelCache<TextDocument>(
		10,
		60,
		document => documentRegions.get(document).getEmbeddedDocument('html')
	);
	const embeddedHTMLDocuments = getLanguageModelCache<HTMLDocument>(
		10,
		60,
		document => htmlLanguageService.parseHTMLDocument(embeddedTextDocuments.get(document))
	);

	return {
		getId() {
			return 'html';
		},
		configure(options: any) {
			globalSettings = options;
		},
		doComplete(document: TextDocument, position: Position, settings: Settings = globalSettings) {
			const textDoc = embeddedTextDocuments.get(document)
			const htmlDoc = embeddedHTMLDocuments.get(document)
			let options: {[key: string]: boolean} = {html5: true};
			let doAutoComplete = get(settings, 'vue-ls.template.html.autoClosingTags');
			if (doAutoComplete) {
				options.hideAutoCompleteProposals = true;
			}
			return htmlLanguageService.doComplete(textDoc, position, htmlDoc, options);
		},
		doHover(document: TextDocument, position: Position) {
			const textDoc = embeddedTextDocuments.get(document)
			const htmlDoc = embeddedHTMLDocuments.get(document)
			return htmlLanguageService.doHover(textDoc, position, htmlDoc);
		},
		findDocumentHighlight(document: TextDocument, position: Position) {
			const textDoc = embeddedTextDocuments.get(document)
			const htmlDoc = embeddedHTMLDocuments.get(document)
			return htmlLanguageService.findDocumentHighlights(textDoc, position, htmlDoc);
		},
		findDocumentLinks(document: TextDocument, documentContext: DocumentContext) {
			const textDoc = embeddedTextDocuments.get(document)
			return htmlLanguageService.findDocumentLinks(textDoc, documentContext);
		},
		findDocumentSymbols(document: TextDocument) {
			const textDoc = embeddedTextDocuments.get(document)
			const htmlDoc = embeddedHTMLDocuments.get(document)
			return htmlLanguageService.findDocumentSymbols(textDoc, htmlDoc);
		},
		format(document: TextDocument, range: Range, formatParams: FormattingOptions, settings: Settings = globalSettings) {
			let formatSettings: HTMLFormatConfiguration = get(settings, 'vue-ls.template.html.format');
			if (formatSettings) {
				formatSettings = merge(formatSettings, {});
			} else {
				formatSettings = {};
			}
			formatSettings = merge(formatParams, formatSettings);

			let start = document.offsetAt(range.start);
			let end = document.offsetAt(range.end);
			const textDocContent = document.getText().substring(start, end)
			let textDoc = TextDocument.create(document.uri, 'html', document.version, textDocContent)
			let edits = htmlLanguageService.format(textDoc, null, formatSettings);

			if (edits) {
				const result = []
				const diff = JsDiff.diffChars(textDocContent, `\n  ${edits[0].newText.replace(/\n/g, '\n  ')}\n`)
				let offset = start
				for (let item of diff) {
					if (item.added || item.removed) {
						result.push({
							range: {
								start: document.positionAt(offset),
								end: document.positionAt(offset + (item.added ? 0 : item.count))
							},
							newText: item.removed ? '' : item.value
						})
					}
					if (!item.added) {offset += item.count}
				}
				return result
			}
			return []
		},
		doAutoClose(document: TextDocument, position: Position) {
			const textDoc = embeddedTextDocuments.get(document)
			const htmlDoc = embeddedHTMLDocuments.get(document)
			let offset = document.offsetAt(position);
			let text = document.getText();
			if (offset > 0 && text.charAt(offset - 1).match(/[>\/]/g)) {
				return htmlLanguageService.doTagComplete(textDoc, position, htmlDoc);
			}
			return null;
		},
		onDocumentRemoved(document: TextDocument) {
			embeddedTextDocuments.onDocumentRemoved(document);
			embeddedHTMLDocuments.onDocumentRemoved(document);
		},
		dispose() {
			embeddedTextDocuments.dispose();
			embeddedHTMLDocuments.dispose();
		}
	};
};

function merge(src: any, dst: any): any {
	for (var key in src) {
		if (src.hasOwnProperty(key)) {
			dst[key] = src[key];
		}
	}
	return dst;
}
