/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument } from 'vscode-languageserver-types';
import { LanguageMode } from './languageModes';

export function getVueMode(): LanguageMode {
	return {
		getId() {
			return 'vue';
		},
		onDocumentRemoved(_: TextDocument) {},
		dispose() {}
	};
};
