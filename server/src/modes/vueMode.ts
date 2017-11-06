/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument } from 'vscode-languageserver-types';
import { LanguageMode, Settings } from './languageModes';

export function getVueMode(): LanguageMode {
	let globalSettings: Settings = {};
	return {
		getId() {
			return 'vue';
		},
		configure(options: any) {
			globalSettings = options;
		},
		onDocumentRemoved(document: TextDocument) {},
		dispose() {}
	};
};
